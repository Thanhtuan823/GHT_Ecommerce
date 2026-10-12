import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosClient from '../../utils/axiosClient';
import { useToast } from '../../components/common/ToastContext';
import Skeleton from '../../components/common/Skeleton';
import PaymentQrModal from './PaymentQrModal';

const Payment = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await axiosClient.get(`/orders/${orderId}`);
        setOrder(res.data);

        if (res.data.status !== 'PENDING_PAYMENT') {
          navigate(`/orders/${orderId}`);
        }
      } catch {
        toast.error('Lỗi tải đơn hàng');
        navigate('/');
      } finally {
        setIsLoading(false);
      }
    };
    fetchOrder();
  }, [orderId, navigate, toast]);

  if (isLoading) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '32px' }}>
        <Skeleton height="32px" style={{ marginBottom: '24px' }} />
        <Skeleton height="200px" style={{ marginBottom: '24px' }} />
        <Skeleton height="150px" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <PaymentQrModal
      order={order}
      onClose={() => navigate(`/orders/${orderId}`)}
    />
  );
};

export default Payment;
