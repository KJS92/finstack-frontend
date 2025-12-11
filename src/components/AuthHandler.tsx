import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Capture hash immediately before React Router can clear it
    const hash = window.location.hash;
    
    if (hash && hash.includes('access_token')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      console.log('AuthHandler detected token:', { type, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken });
      
      if (type === 'recovery' && accessToken && refreshToken) {
        // This is a password reset link
        // Set the session immediately
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error setting session:', error);
            navigate('/password-reset');
          } else {
            console.log('Session set, navigating to update-password');
            // Clear hash and navigate
            window.history.replaceState(null, '', '/update-password');
            navigate('/update-password', { replace: true });
          }
        });
      }
    }
  }, []); // Empty dependency array - run only once on mount

  return null;
};

export default AuthHandler;
