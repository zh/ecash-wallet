import { memo, useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useAtom } from 'jotai';
import { walletAtom } from '../atoms';
import '../styles/tokenicon.css';

// Simple in-memory cache for token metadata
const metadataCache = new Map();
const IMAGE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const FETCH_TIMEOUT = 8000; // 8 seconds for IPFS/HTTP fetches

const TokenIcon = ({ token, zoomed = false }) => {
  const [wallet] = useAtom(walletAtom);
  const [tokenImage, setTokenImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const abortControllerRef = useRef(null);

  // Convert IPFS URLs to gateway URLs with multiple fallbacks
  const convertIpfsUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('ipfs://')) {
      const hash = url.substring(7);
      // Return primary gateway, fallbacks can be tried on error
      return `https://ipfs.io/ipfs/${hash}`;
    }
    // Fix malformed URLs that are missing protocols
    if (url && !url.startsWith('http') && !url.startsWith('ipfs://')) {
      // Common cases like "cashtab.com" -> "https://cashtab.com"
      return `https://${url}`;
    }
    return url;
  };

  // Get additional IPFS gateways for fallback
  const getIpfsGatewayFallbacks = (hash) => [
    `https://gateway.pinata.cloud/ipfs/${hash}`,
    `https://cloudflare-ipfs.com/ipfs/${hash}`,
    `https://dweb.link/ipfs/${hash}`
  ];

  // Validate image URL format
  const isValidImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return url.match(/\.(jpg|jpeg|png|gif|svg|webp)(\?.*)?$/i) ||
           url.includes('ipfs') ||
           url.startsWith('http');
  };

  // Fetch with timeout for slow IPFS/HTTP requests
  const fetchWithTimeout = async (url, timeoutMs = FETCH_TIMEOUT) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json, image/*'
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  // Enhanced token icon fetching: CashTab centralized server first, then distributed metadata fallback
  useEffect(() => {
    const fetchTokenIcon = async () => {
      if (!wallet || !token || !token.tokenId || imageLoading || tokenImage || imageError) {
        return;
      }

      // Check cache first
      const cacheKey = token.tokenId;
      const cached = metadataCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < IMAGE_CACHE_DURATION) {
        if (cached.imageUrl) {
          setTokenImage(cached.imageUrl);
        } else {
          setImageError(true);
        }
        return;
      }

      try {
        setImageLoading(true);
        setImageError(false);

        // Create abort controller for this request
        abortControllerRef.current = new AbortController();

        let finalImageUrl = null;

        // STEP 1: Try CashTab centralized icon server first (like CashTab wallet)
        const cashtabIconUrl = `https://icons.etokens.cash/64/${token.tokenId}.png`;

        try {
          const cashtabResponse = await fetchWithTimeout(cashtabIconUrl, 5000);
          if (cashtabResponse.ok && cashtabResponse.headers.get('content-type')?.includes('image')) {
            finalImageUrl = cashtabIconUrl;
          }
        } catch {
          // CashTab server failed, continue to distributed metadata
        }

        // STEP 2: If CashTab server fails, try distributed metadata approach (IPFS/HTTP)
        if (!finalImageUrl) {
          const tokenData = await wallet.getETokenData(token.tokenId);

          if (tokenData && tokenData.url) {
            const metadataUrl = convertIpfsUrl(tokenData.url);

            if (metadataUrl) {
              // Check if URL is direct image
              if (metadataUrl.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
                finalImageUrl = metadataUrl;
              } else {
                // Try to fetch as JSON metadata with timeout
                try {
                  const response = await fetchWithTimeout(metadataUrl);
                  if (response.ok) {
                    const contentType = response.headers.get('content-type') || '';

                    if (contentType.includes('application/json')) {
                      const metadata = await response.json();

                      // Look for image in common metadata fields
                      const imageUrl = metadata.image || metadata.icon || metadata.logo ||
                                     metadata.imageUrl || metadata.img || metadata.picture;

                      if (imageUrl && isValidImageUrl(imageUrl)) {
                        finalImageUrl = convertIpfsUrl(imageUrl);
                      }
                    }
                  }
                } catch (fetchError) {
                  console.warn(`Distributed metadata fetch failed for ${token.tokenId}:`, fetchError.message);

                  // If it's an IPFS URL and fetch failed, try fallback gateways
                  if (metadataUrl.includes('ipfs.io/ipfs/')) {
                    const hash = metadataUrl.split('/ipfs/')[1];
                    const fallbacks = getIpfsGatewayFallbacks(hash);

                    for (const fallbackUrl of fallbacks) {
                      try {
                        const fallbackResponse = await fetchWithTimeout(fallbackUrl, FETCH_TIMEOUT / 2);
                        if (fallbackResponse.ok) {
                          const metadata = await fallbackResponse.json();
                          const imageUrl = metadata.image || metadata.icon || metadata.logo;
                          if (imageUrl && isValidImageUrl(imageUrl)) {
                            finalImageUrl = convertIpfsUrl(imageUrl);
                            break;
                          }
                        }
                      } catch {
                        // Continue to next fallback
                        continue;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // Cache the result (success or failure)
        metadataCache.set(cacheKey, {
          imageUrl: finalImageUrl,
          timestamp: Date.now()
        });

        if (finalImageUrl) {
          setTokenImage(finalImageUrl);
        } else {
          setImageError(true);
        }
      } catch (error) {
        console.warn(`Failed to fetch icon for token ${token.tokenId}:`, error.message);

        // Cache the failure to avoid repeated failed requests
        metadataCache.set(cacheKey, {
          imageUrl: null,
          timestamp: Date.now()
        });
        setImageError(true);
      } finally {
        setImageLoading(false);
        abortControllerRef.current = null;
      }
    };

    fetchTokenIcon();

    // Cleanup function to abort ongoing requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [wallet, token, imageLoading, tokenImage, imageError]);

  if (!token) {
    return (
      <div
        className={`token-icon-placeholder ${zoomed ? 'zoomed-icon' : ''}`}
        title="Default token icon"
      >
        🪙
      </div>
    );
  }

  // Generate a color based on token ID for visual distinction
  const getTokenColor = (tokenId) => {
    if (!tokenId) return '#666';

    // Use first 6 chars of tokenId as hex color
    const hex = tokenId.slice(0, 6);
    const isValidHex = /^[0-9A-Fa-f]{6}$/.test(hex);
    return isValidHex ? `#${hex}` : '#666';
  };

  // Get protocol icon based on token type
  const getProtocolIcon = (type) => {
    switch (type?.toUpperCase()) {
      case 'SLP':
        return '🔗'; // SLP icon
      case 'ALP':
        return '🦎'; // ALP icon (Antelope)
      default:
        return '🪙'; // Generic token icon
    }
  };

  const tokenColor = getTokenColor(token.tokenId);
  const protocolIcon = getProtocolIcon(token.type);
  const iconClass = `token-icon ${zoomed ? 'zoomed-icon' : ''}`;
  const size = zoomed ? '80px' : '48px';

  // Handle image loading errors with IPFS fallback attempts
  const handleImageError = async () => {
    console.warn(`Image load failed for ${token.tokenId}: ${tokenImage}`);

    // If it's an IPFS image, try fallback gateways
    if (tokenImage && tokenImage.includes('ipfs.io/ipfs/')) {
      const hash = tokenImage.split('/ipfs/')[1];
      const fallbacks = getIpfsGatewayFallbacks(hash);

      for (const fallbackUrl of fallbacks) {
        try {
          // Test if fallback URL loads
          const testImg = new Image();
          testImg.onload = () => {
            setTokenImage(fallbackUrl);
            return;
          };
          testImg.onerror = () => {
            // Continue to next fallback
          };
          testImg.src = fallbackUrl;

          // Wait a bit for the test
          await new Promise(resolve => setTimeout(resolve, 2000));

          // If we get here, try the next fallback
          continue;
        } catch {
          continue;
        }
      }
    }

    // All fallbacks failed or not an IPFS URL
    setImageError(true);
    setTokenImage(null);

    // Update cache to mark as failed
    const cacheKey = token.tokenId;
    metadataCache.set(cacheKey, {
      imageUrl: null,
      timestamp: Date.now()
    });
  };

  // If we have a real token image, show it
  if (tokenImage && !imageError) {
    return (
      <div
        className={iconClass}
        style={{
          borderRadius: '8px',
          overflow: 'hidden',
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title={`${token.name || 'Token'} (${token.type || 'Unknown'}) - Image from ${tokenImage.includes('ipfs') ? 'IPFS' : 'HTTP'}`}
      >
        <img
          src={tokenImage}
          alt={`${token.name || 'Token'} icon`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '8px'
          }}
          onError={handleImageError}
          loading="lazy"
        />
      </div>
    );
  }

  // Loading state - show protocol icon with subtle animation
  if (imageLoading) {
    return (
      <div
        className={`${iconClass} loading`}
        style={{
          backgroundColor: tokenColor,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: zoomed ? '32px' : '24px',
          width: size,
          height: size,
          color: 'white',
          fontWeight: 'bold',
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
          opacity: 0.7
        }}
        title={`Loading ${token.name || 'Token'} image...`}
      >
        {protocolIcon}
      </div>
    );
  }

  // Fallback to protocol icon if no image or error
  return (
    <div
      className={iconClass}
      style={{
        backgroundColor: tokenColor,
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: zoomed ? '32px' : '24px',
        width: size,
        height: size,
        color: 'white',
        fontWeight: 'bold',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
      }}
      title={`${token.name || 'Token'} (${token.type || 'Unknown'})`}
    >
      {protocolIcon}
    </div>
  );
};

TokenIcon.propTypes = {
  token: PropTypes.shape({
    tokenId: PropTypes.string,
    name: PropTypes.string,
    type: PropTypes.string,
  }),
  zoomed: PropTypes.bool,
};

export default memo(TokenIcon);