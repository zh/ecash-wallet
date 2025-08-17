import MobileLayout from '../components/Layout/MobileLayout';
import SendXEC from '../components/SendXEC';

const SendPage = () => {
  return (
    <MobileLayout title="Send">
      <div className="send-content">
        <SendXEC />
      </div>
    </MobileLayout>
  );
};

export default SendPage;