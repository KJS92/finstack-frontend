import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if URL has password recovery token
    const hash = window.location.hash;
    
    if (hash && hash.includes('type=recovery')) {
      // This is a password reset link
      // Navigate to update-password page with the hash preserved
      navigate('/update-password' + hash);
    }
  }, [location, navigate]);

  return null; // This component doesn't render anything
};

export default AuthHandler;
