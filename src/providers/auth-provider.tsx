import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';

const AUTH_STORAGE_KEY = 'epbox.auth.session';

const DEMO_CREDENTIALS = {
  id: '',
  password: '',
} as const;

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (userId: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  demoCredentials: typeof DEMO_CREDENTIALS;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function getStoredSession() {
  if (Platform.OS === 'web') {
    return globalThis.localStorage?.getItem(AUTH_STORAGE_KEY) ?? null;
  }

  return SecureStore.getItemAsync(AUTH_STORAGE_KEY);
}

async function setStoredSession(value: string) {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.setItem(AUTH_STORAGE_KEY, value);
    return;
  }

  await SecureStore.setItemAsync(AUTH_STORAGE_KEY, value);
}

async function clearStoredSession() {
  if (Platform.OS === 'web') {
    globalThis.localStorage?.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const rawSession = await getStoredSession();

        if (!rawSession || !isMounted) {
          return;
        }

        const parsed = JSON.parse(rawSession) as { authenticated?: boolean };
        setIsAuthenticated(parsed.authenticated === true);
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (userId: string, password: string) => {
    const isValid = userId === DEMO_CREDENTIALS.id && password === DEMO_CREDENTIALS.password;

    if (!isValid) {
      return false;
    }

    await setStoredSession(JSON.stringify({ authenticated: true }));
    setIsAuthenticated(true);
    return true;
  };

  const signOut = async () => {
    await clearStoredSession();
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        signIn,
        signOut,
        demoCredentials: DEMO_CREDENTIALS,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
