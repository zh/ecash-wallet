import MobileLayout from '../components/Layout/MobileLayout';
import TokensList from '../components/TokensList';

const TokensPage = () => {
  return (
    <MobileLayout title="eTokens">
      <TokensList />
    </MobileLayout>
  );
};

export default TokensPage;