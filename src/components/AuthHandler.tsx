import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../config/supabase';

const AuthHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check for token in hash on ANY page
    const hash = window.location.hash;
    
    if (hash && hash.includes('access_token')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const type = hashParams.get('type');
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      
      console.log('AuthHandler detected:', { 
        currentPath: location.pathname,
        type, 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken 
      });
      
      if (type === 'recovery' && accessToken && refreshToken) {
        console.log('Password recovery detected, setting session...');
        
        // Set the session immediately
        supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        }).then(({ data, error }) => {
          if (error) {
            console.error('Error setting session:', error);
            navigate('/password-reset');
          } else {
            console.log('Session set successfully! Navigating to update-password');
            // Navigate to update-password page
            navigate('/update-password', { replace: true });
            // Clean up URL
            window.history.replaceState({}, document.title, '/update-password');
          }
        }).catch(err => {
          console.error('Catch error:', err);
          navigate('/password-reset');
        });
      }
    }
  }, [location, navigate]);

  return null;
};

export default AuthHandler;
