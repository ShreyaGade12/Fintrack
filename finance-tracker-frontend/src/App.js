import React, { useState, useEffect, createContext, useContext } from 'react';
// Firebase imports
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'; // getFirestore is imported for completeness, though not directly used for app data in this frontend
import io from 'socket.io-client'; // Import Socket.IO client

// Create a context for authentication to be used throughout the app
const AuthContext = createContext(null);

// Base URL for your backend API
const BASE_URL = 'http://backend:5000'; // Changed for Docker Compose environment. No /api here.
const SOCKET_URL = 'http://localhost:5000'; // Socket.IO connects directly to the backend server URL

// --- A/B Testing Configuration (Frontend-managed for simplicity) ---
// In a real-world scenario, this would be fetched from a backend service.
const AB_TEST_CONFIG = {
  experimentName: 'addExpenseButtonColor',
  variations: {
    control: {
      buttonColorClass: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
      label: 'Add Expense'
    },
    variantA: {
      buttonColorClass: 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
      label: 'Record New Spend'
    }
  },
  // Distribution: 0.5 for control, 0.5 for variantA
  distribution: { control: 0.5, variantA: 0.5 }
};

// Function to assign a user to an A/B test variant
const assignVariant = (experimentName, distribution) => {
  const storedVariant = localStorage.getItem(`ab_test_${experimentName}_variant`);
  if (storedVariant) {
    return storedVariant; // Return existing assignment
  }

  const random = Math.random();
  let cumulativeProbability = 0;
  let assignedVariant = 'control'; // Default to control

  for (const variant in distribution) {
    cumulativeProbability += distribution[variant];
    if (random < cumulativeProbability) {
      assignedVariant = variant;
      break;
    }
  }
  localStorage.setItem(`ab_test_${experimentName}_variant`, assignedVariant);
  return assignedVariant;
};

// --- End A/B Testing Configuration ---


// AuthProvider component to manage authentication state
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Firebase user object
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [auth, setAuth] = useState(null); // Firebase Auth instance
  const [db, setDb] = useState(null); // Firebase Firestore instance

  // A/B Test state
  const [abTestVariant, setAbTestVariant] = useState(null);

  useEffect(() => {
    try {
      // --- FIREBASE CONFIGURATION FOR LOCAL DEVELOPMENT ---
      // In the Canvas environment, __firebase_config is provided globally.
      // For local development, we need to provide a fallback Firebase config.
      // !!! IMPORTANT: YOU MUST REPLACE THE PLACEHOLDER STRINGS BELOW WITH YOUR ACTUAL FIREBASE PROJECT'S WEB CONFIGURATION !!!
      // You can get this from your Firebase Console -> Project settings -> Your apps -> Web app -> Config
      const firebaseConfig = typeof window !== 'undefined' && window.__firebase_config !== undefined
        ? JSON.parse(window.__firebase_config)
        : {
            // Replace these with your actual Firebase Web App Configuration.
            // This is NOT the Service Account Key JSON.
            apiKey: "YOUR_FIREBASE_WEB_API_KEY", // e.g., "AIzaSyC..."
            authDomain: "your-project-id.firebaseapp.com",
            projectId: "your-project-id",
            storageBucket: "your-project-id.appspot.com",
            messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
            appId: "YOUR_APP_ID",
            // measurementId: "G-XXXXXXXXXX"// Include if you use Firebase Analytics it
          };

      const app = initializeApp(firebaseConfig);
      const authInstance = getAuth(app);
      const dbInstance = getFirestore(app);

      setAuth(authInstance);
      setDb(dbInstance);

      // --- INITIAL AUTH TOKEN FOR CANVAS ENVIRONMENT ---
      // __initial_auth_token is provided by the Canvas environment for custom token sign-in.
      // For local development, it will be undefined, so we default it to null.
      const initialAuthToken = typeof window !== 'undefined' && window.__initial_auth_token !== undefined ? window.__initial_auth_token : null;

      const signInWithCanvasToken = async () => {
        try {
          if (initialAuthToken) {
            console.log("Attempting Firebase sign-in with custom token...");
            await signInWithCustomToken(authInstance, initialAuthToken);
          } else {
            console.log("No custom token found, attempting anonymous Firebase sign-in...");
            // For local development without a real Firebase project, anonymous sign-in is a good fallback.
            // If you have a real Firebase project and want to force login, you can remove this line.
            await signInAnonymously(authInstance);
          }
        } catch (error) {
          console.error("Firebase initial sign-in error:", error);
          // If custom token fails or other errors occur, fall back to anonymous if no user is signed in
          if (!authInstance.currentUser) {
             console.log("Falling back to anonymous sign-in due to error.");
             await signInAnonymously(authInstance);
          }
        }
      };

      signInWithCanvasToken();

      // Listen for Firebase authentication state changes
      const unsubscribe = onAuthStateChanged(authInstance, (currentUser) => {
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
          console.log("Firebase User ID:", currentUser.uid);
          // Assign A/B test variant once user is authenticated
          const variant = assignVariant(AB_TEST_CONFIG.experimentName, AB_TEST_CONFIG.distribution);
          setAbTestVariant(variant);
          // Track experiment participation
          trackAnalyticsEvent('experiment_participation', {
            userId: currentUser.uid,
            experimentName: AB_TEST_CONFIG.experimentName,
            variant: variant
          });

        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAbTestVariant(null); // Clear variant on logout
          console.log("No Firebase user logged in.");
        }
        setLoadingAuth(false);
      });

      return () => unsubscribe(); // Cleanup subscription on unmount
    } catch (error) {
      console.error("Error initializing Firebase or AuthProvider:", error);
      setLoadingAuth(false);
    }
  }, []); // Empty dependency array means this runs once on component mount

  // Provide the Firebase user, isAuthenticated status, loading state, and auth instance to children
  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loadingAuth, auth, abTestVariant }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
const useAuth = () => useContext(AuthContext);

// --- Analytics Tracking Function ---
// This function sends custom events to your backend for analytics.
const trackAnalyticsEvent = async (eventName, eventProperties = {}) => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('Cannot track event: Authentication token not found.');
      return;
    }
    const userId = eventProperties.userId; // userId must be passed explicitly

    const response = await fetch(`${BASE_URL}/api/analytics/track-event`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        eventName,
        eventProperties: { ...eventProperties, timestamp: new Date().toISOString() },
        userId // Always send userId with event
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`Failed to track analytics event ${eventName}:`, errorData.message);
    } else {
      console.log(`Analytics event '${eventName}' tracked successfully.`, eventProperties);
    }
  } catch (error) {
    console.error(`Error tracking analytics event ${eventName}:`, error);
  }
};


// --- Reusable UI Components ---

const InputField = ({ label, type = 'text', value, onChange, placeholder, required = false }) => (
  <div className="mb-4">
    <label className="block mb-2 text-sm font-semibold text-gray-800">{label}</label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      className="w-full px-4 py-2 transition duration-200 ease-in-out border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
);

const SelectField = ({ label, value, onChange, options, required = false }) => (
  <div className="mb-4">
    <label className="block mb-2 text-sm font-semibold text-gray-800">{label}</label>
    <select
      value={value}
      onChange={onChange}
      required={required}
      className="w-full px-4 py-2 transition duration-200 ease-in-out bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

const Button = ({ onClick, children, className = '', type = 'button', disabled = false }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`
      bg-gradient-to-r from-blue-600 to-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md
      hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75
      transition duration-300 ease-in-out transform hover:scale-105
      ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
    `}
  >
    {children}
  </button>
);

const LoadingSpinner = () => (
  <div className="flex items-center justify-center py-4">
    <div className="w-8 h-8 border-b-2 border-blue-500 rounded-full animate-spin"></div>
    <p className="ml-2 text-gray-600">Loading...</p>
  </div>
);

const ErrorMessage = ({ message }) => (
  <div className="relative px-4 py-3 mb-4 text-red-700 bg-red-100 border border-red-400 rounded-lg shadow-sm" role="alert">
    <strong className="font-bold">Error!</strong>
    <span className="block ml-2 sm:inline">{message}</span>
  </div>
);

const SuccessMessage = ({ message }) => (
  <div className="relative px-4 py-3 mb-4 text-green-700 bg-green-100 border border-green-400 rounded-lg shadow-sm" role="alert">
    <strong className="font-bold">Success!</strong>
    <span className="block ml-2 sm:inline">{message}</span>
  </div>
);

// --- Authentication Components ---

const AuthCard = ({ title, children, switchText, onSwitch }) => (
  <div className="max-w-md p-8 mx-auto mt-10 bg-white border border-gray-200 shadow-2xl rounded-xl animate-fade-in">
    <h2 className="mb-6 text-4xl font-extrabold text-center text-gray-900">{title}</h2>
    {children}
    <p className="mt-6 text-center text-gray-600">
      {switchText}{' '}
      <button onClick={onSwitch} className="font-semibold text-blue-600 transition duration-200 hover:text-blue-800 focus:outline-none">
        {title === 'Login' ? 'Register' : 'Login'}
      </button>
    </p>
  </div>
);

const RegisterForm = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { auth } = useAuth(); // Get Firebase Auth instance

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!auth) {
      setError("Firebase authentication not initialized. Please try again.");
      setLoading(false);
      return;
    }

    try {
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log("Firebase user created:", firebaseUser.uid);

      // 2. Register user in your Node.js backend, passing Firebase UID
      const response = await fetch(`${BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password, firebaseUid: firebaseUser.uid }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Registration successful! Please log in.');
        setName('');
        setEmail('');
        setPassword('');
        // No need to set token here, login form will handle it
        onRegisterSuccess();
      } else {
        // If backend registration fails, you might want to delete the Firebase user
        // This is a more advanced error handling scenario. For now, we just report the error.
        setError(data.message || 'Backend registration failed.');
        await firebaseUser.delete(); // Attempt to delete Firebase user if backend fails
      }
    } catch (err) {
      console.error("Registration error:", err);
      // Firebase specific error messages
      if (err.code === 'auth/email-already-in-use') {
        setError('The email address is already in use by another account.');
      } else if (err.code === 'auth/invalid-email') {
        setError('The email address is not valid.');
      } else if (err.code === 'auth/weak-password') {
        setError('The password is too weak.');
      } else {
        setError(err.message || 'Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Register" switchText="Already have an account?" onSwitch={onSwitchToLogin}>
      {error && <ErrorMessage message={error} />}
      {success && <SuccessMessage message={success} />}
      <form onSubmit={handleSubmit}>
        <InputField label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" required />
        <InputField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@example.com" required />
        <InputField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required />
        <Button type="submit" className="w-full mt-4" disabled={loading}>
          {loading ? <LoadingSpinner /> : 'Register'}
        </Button>
      </form>
    </AuthCard>
  );
};

const LoginForm = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { auth } = useAuth(); // Get Firebase Auth instance

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!auth) {
      setError("Firebase authentication not initialized. Please try again.");
      setLoading(false);
      return;
    }

    try {
      // 1. Sign in with Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      console.log("Firebase user signed in:", firebaseUser.uid);

      // 2. Get Firebase ID token to send to your backend
      const idToken = await firebaseUser.getIdToken();

      // 3. Call your Node.js backend's login endpoint with the Firebase UID and ID Token
      const response = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`, // Send Firebase ID token for verification on backend
        },
        body: JSON.stringify({ email, password, firebaseUid: firebaseUser.uid }), // Still send email/password/uid for your backend's user lookup/validation
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token); // Store your backend's JWT token
        onLoginSuccess();
      } else {
        setError(data.message || 'Backend login failed.');
        await signOut(auth); // Sign out from Firebase if backend login fails
      }
    } catch (err) {
      console.error("Login error:", err);
      // Firebase specific error messages
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/invalid-email') {
        setError('The email address is not valid.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many login attempts. Please try again later.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Login" switchText="Don't have an account?" onSwitch={onSwitchToRegister}>
      {error && <ErrorMessage message={error} />}
      <form onSubmit={handleSubmit}>
        <InputField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@example.com" required />
        <InputField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" required />
        <Button type="submit" className="w-full mt-4" disabled={loading}>
          {loading ? <LoadingSpinner /> : 'Login'}
        </Button>
      </form>
    </AuthCard>
  );
};

// --- Dashboard Component ---

const Dashboard = () => {
  const { user } = useAuth();
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [topVendors, setTopVendors] = useState([]); // New state for top vendors
  const [recurringExpenses, setRecurringExpenses] = useState([]); // New state for recurring expenses
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in.');
          setLoading(false);
          return;
        }

        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        };

        // Fetch recent expenses
        const expensesRes = await fetch(`${BASE_URL}/api/expenses/recent`, { headers });
        const expensesData = await expensesRes.json();
        if (expensesRes.ok) {
          setRecentExpenses(expensesData);
        } else {
          setError(expensesData.message || 'Failed to fetch recent expenses.');
        }

        // Fetch active budgets
        const budgetsRes = await fetch(`${BASE_URL}/api/budget/active`, { headers });
        const budgetsData = await budgetsRes.json();
        if (budgetsRes.ok) {
          setBudgets(budgetsData);
        } else {
          setError(budgetsData.message || 'Failed to fetch budgets.');
        }

        // Fetch active goals
        const goalsRes = await fetch(`${BASE_URL}/api/goals/active`, { headers });
        const goalsData = await goalsRes.json();
        if (goalsRes.ok) {
          setGoals(goalsData);
        } else {
          setError(goalsData.message || 'Failed to fetch goals.');
        }

        // Fetch top vendors (new backend endpoint needed)
        const topVendorsRes = await fetch(`${BASE_URL}/api/analytics/top-vendors/${user.uid}`, { headers });
        const topVendorsData = await topVendorsRes.json();
        if (topVendorsRes.ok) {
          setTopVendors(topVendorsData);
        } else {
          setError(topVendorsData.message || 'Failed to fetch top vendors.');
        }

        // Fetch recurring expenses (new backend endpoint needed or existing one)
        const recurringExpensesRes = await fetch(`${BASE_URL}/api/expenses/recurring`, { headers });
        const recurringExpensesData = await recurringExpensesRes.json();
        if (recurringExpensesRes.ok) {
          setRecurringExpenses(recurringExpensesData);
        } else {
          setError(recurringExpensesData.message || 'Failed to fetch recurring expenses.');
        }


      } catch (err) {
        setError('Network error or failed to fetch dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    if (user) { // Only fetch data if a Firebase user is available
      fetchData();
    }
  }, [user]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="mb-8 text-5xl font-extrabold text-center text-gray-900 drop-shadow-sm">Welcome, <span className="text-blue-600">{user?.displayName || user?.email || 'User'}</span>!</h1>
      <p className="mb-12 text-lg text-center text-gray-600">Firebase User ID: <span className="px-3 py-1 font-mono text-sm bg-gray-200 border border-gray-300 rounded-md">{user?.uid || 'N/A'}</span></p>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Expenses Card */}
        <div className="p-6 transition duration-300 ease-in-out transform bg-white border border-gray-100 shadow-xl rounded-xl hover:scale-102">
          <h2 className="flex items-center mb-4 text-2xl font-bold text-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Recent Expenses
          </h2>
          {recentExpenses.length > 0 ? (
            <ul className="space-y-3">
              {recentExpenses.map((expense) => (
                <li key={expense._id} className="flex items-center justify-between p-3 transition duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100">
                  <div>
                    <p className="text-base font-semibold text-gray-700">{expense.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{expense.category} - {new Date(expense.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-lg font-bold text-red-600">₹{expense.amount.toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-gray-500">No recent expenses found. Start tracking!</p>
          )}
        </div>

        {/* Active Budgets Card */}
        <div className="p-6 transition duration-300 ease-in-out transform bg-white border border-gray-100 shadow-xl rounded-xl hover:scale-102">
          <h2 className="flex items-center mb-4 text-2xl font-bold text-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6m-5 0h.01M9 12h6m-5 0h.01M9 16h6m-5 0h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Active Budgets
          </h2>
          {budgets.length > 0 ? (
            <ul className="space-y-3">
              {budgets.map((budget) => (
                <li key={budget._id} className="p-3 transition duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100">
                  <p className="text-base font-semibold text-gray-700">{budget.name} ({budget.category})</p>
                  <div className="w-full h-3 mt-2 overflow-hidden bg-gray-200 rounded-full">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        budget.spentPercentage >= budget.alertThresholds.critical.percentage ? 'bg-red-500' :
                        budget.spentPercentage >= budget.alertThresholds.warning.percentage ? 'bg-orange-400' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, budget.spentPercentage)}%` }}
                    ></div>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Spent: <span className="font-bold">₹{budget.spent.toLocaleString()}</span> / ₹{budget.amount.toLocaleString()} ({budget.spentPercentage}%)
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-gray-500">No active budgets found. Create one!</p>
          )}
        </div>

        {/* Active Goals Card */}
        <div className="p-6 transition duration-300 ease-in-out transform bg-white border border-gray-100 shadow-xl rounded-xl hover:scale-102">
          <h2 className="flex items-center mb-4 text-2xl font-bold text-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Active Goals
          </h2>
          {goals.length > 0 ? (
            <ul className="space-y-3">
              {goals.map((goal) => (
                <li key={goal._id} className="p-3 transition duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100">
                  <p className="text-base font-semibold text-gray-700">{goal.title}</p>
                  <div className="w-full h-3 mt-2 overflow-hidden bg-gray-200 rounded-full">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        goal.progressPercentage >= 100 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${Math.min(100, goal.progressPercentage)}%` }}
                    ></div>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    Progress: <span className="font-bold">₹{goal.currentAmount.toLocaleString()}</span> / ₹{goal.targetAmount.toLocaleString()} ({goal.progressPercentage}%)
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-gray-500">No active goals found. Set a new goal!</p>
          )}
        </div>

        {/* Top Vendors Card */}
        <div className="p-6 transition duration-300 ease-in-out transform bg-white border border-gray-100 shadow-xl rounded-xl hover:scale-102">
          <h2 className="flex items-center mb-4 text-2xl font-bold text-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m7 0V5a2 2 0 012-2h2a2 2 0 012 2v6m-6 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v6" />
            </svg>
            Top Vendors
          </h2>
          {topVendors.length > 0 ? (
            <ul className="space-y-3">
              {topVendors.map((vendor, index) => (
                <li key={index} className="flex items-center justify-between p-3 transition duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100">
                  <p className="text-base font-semibold text-gray-700">{vendor.name}</p>
                  <p className="text-lg font-bold text-gray-800">₹{vendor.totalAmount.toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-gray-500">No top vendors found.</p>
          )}
        </div>

        {/* Recurring Expenses Card */}
        <div className="p-6 transition duration-300 ease-in-out transform bg-white border border-gray-100 shadow-xl rounded-xl hover:scale-102">
          <h2 className="flex items-center mb-4 text-2xl font-bold text-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004 12V8m5.418-3H19m-2 2l-2 2m0 0l-2 2m2-2V4m-2 2h2" />
            </svg>
            Recurring Expenses
          </h2>
          {recurringExpenses.length > 0 ? (
            <ul className="space-y-3">
              {recurringExpenses.map((expense) => (
                <li key={expense._id} className="flex items-center justify-between p-3 transition duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100">
                  <div>
                    <p className="text-base font-semibold text-gray-700">{expense.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {expense.recurringDetails.frequency} - ₹{expense.amount.toLocaleString()}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-red-600">₹{expense.amount.toLocaleString()}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-gray-500">No recurring expenses found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Expense Management Component ---

const ExpenseManagement = () => {
  const { user, abTestVariant } = useAuth(); // Get abTestVariant from context
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [mood, setMood] = useState(''); // New state for mood tagging

  const categories = [
    { value: 'food', label: 'Food' }, { value: 'transport', label: 'Transport' },
    { value: 'shopping', label: 'Shopping' }, { value: 'entertainment', label: 'Entertainment' },
    { value: 'healthcare', label: 'Healthcare' }, { value: 'utilities', label: 'Utilities' },
    { value: 'education', label: 'Education' }, { value: 'travel', label: 'Travel' },
    { value: 'fitness', label: 'Fitness' }, { value: 'groceries', label: 'Groceries' },
    { value: 'dining', label: 'Dining' }, { value: 'fuel', label: 'Fuel' },
    { value: 'insurance', label: 'Insurance' }, { value: 'investment', label: 'Investment' },
    { value: 'charity', label: 'Charity' }, { value: 'personal_care', label: 'Personal Care' },
    { value: 'home', label: 'Home' }, { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' }, { value: 'books', label: 'Books' },
    { value: 'subscriptions', label: 'Subscriptions' }, { value: 'gifts', label: 'Gifts' },
    { value: 'taxi', label: 'Taxi' }, { value: 'other', label: 'Other' }
  ];

  const paymentMethods = [
    { value: 'cash', label: 'Cash' }, { value: 'card', label: 'Card' },
    { value: 'upi', label: 'UPI' }, { value: 'net_banking', label: 'Net Banking' },
    { value: 'wallet', label: 'Wallet' }, { value: 'other', label: 'Other' }
  ];

  const moods = [
    { value: '', label: 'Select Mood (Optional)' },
    { value: 'happy', label: '😊 Happy' },
    { value: 'sad', label: '😔 Sad' },
    { value: 'stressed', label: '😩 Stressed' },
    { value: 'excited', label: '🤩 Excited' },
    { value: 'angry', label: '😡 Angry' },
    { value: 'neutral', label: '😐 Neutral' },
    { value: 'anxious', label: '😟 Anxious' },
    { value: 'celebrating', label: '🥳 Celebrating' }
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${BASE_URL}/api/expenses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setExpenses(data);
      } else {
        setError(data.message || 'Failed to fetch expenses.');
      }
    } catch (err) {
      setError('Network error or failed to fetch expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchExpenses();
    }
  }, [user]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }

      const expensePayload = {
        amount: parseFloat(amount),
        description,
        category,
        paymentMethod: { type: paymentMethod },
        date: new Date().toISOString(), // Use current date for simplicity
        userId: user.uid // Pass Firebase UID
      };

      // Add mood if selected
      if (mood) {
        expensePayload.mood = { tag: mood, isManual: true, detectedAt: new Date().toISOString() };
      }

      const response = await fetch(`${BASE_URL}/api/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(expensePayload),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess('Expense added successfully!');
        setAmount('');
        setDescription('');
        setCategory('food');
        setPaymentMethod('cash');
        setMood(''); // Reset mood
        fetchExpenses(); // Refresh the list

        // --- A/B Testing Conversion Tracking ---
        // Track a conversion event for the A/B test
        if (abTestVariant) {
          trackAnalyticsEvent('expense_added_conversion', {
            userId: user.uid,
            experimentName: AB_TEST_CONFIG.experimentName,
            variant: abTestVariant,
            expenseId: data.id, // Assuming backend returns the ID of the new expense
            amount: expensePayload.amount,
            category: expensePayload.category
          });
        }
        // --- End A/B Testing Conversion Tracking ---

      } else {
        setError(data.message || 'Failed to add expense.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Determine button styles based on A/B test variant
  const currentVariantConfig = AB_TEST_CONFIG.variations[abTestVariant] || AB_TEST_CONFIG.variations.control;
  const buttonClass = `bg-gradient-to-r ${currentVariantConfig.buttonColorClass}`;
  const buttonLabel = currentVariantConfig.label;


  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="mb-8 text-4xl font-extrabold text-center text-gray-900 drop-shadow-sm">Expense Management</h1>

      <div className="max-w-3xl p-8 mx-auto mb-8 bg-white border border-gray-100 shadow-xl rounded-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Add New Expense</h2>
        {error && <ErrorMessage message={error} />}
        {success && <SuccessMessage message={success} />}
        <form onSubmit={handleAddExpense}>
          <InputField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 150.75" required />
          <InputField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Coffee at Cafe" required />
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={categories} required />
          <SelectField label="Payment Method" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} options={paymentMethods} required />
          <SelectField label="Mood" value={mood} onChange={(e) => setMood(e.target.value)} options={moods} /> {/* Mood Selector */}
          <Button type="submit" className={`w-full mt-4 ${buttonClass}`} disabled={loading}>
            {loading ? <LoadingSpinner /> : buttonLabel}
          </Button>
        </form>
      </div>

      <div className="max-w-3xl p-8 mx-auto bg-white border border-gray-100 shadow-xl rounded-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Your Expenses</h2>
        {loading ? (
          <LoadingSpinner />
        ) : expenses.length > 0 ? (
          <ul className="space-y-3">
            {expenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between p-3 transition duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100">
                <div>
                  <p className="text-base font-semibold text-gray-700">{expense.description}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {expense.category} - {new Date(expense.date).toLocaleDateString()}
                    {expense.mood?.tag && ` (${expense.mood.tag})`} {/* Display mood if present */}
                  </p>
                </div>
                <p className="text-lg font-bold text-red-600">₹{parseFloat(expense.amount).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-gray-500">No expenses recorded yet.</p>
        )}
      </div>
    </div>
  );
};

// --- Budget Management Component ---

const BudgetManagement = () => {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState('food');
  const [amount, setAmount] = useState('');
  const [periodType, setPeriodType] = useState('monthly');

  const categories = [
    { value: 'food', label: 'Food' }, { value: 'transport', label: 'Transport' },
    { value: 'shopping', label: 'Shopping' }, { value: 'entertainment', label: 'Entertainment' },
    { value: 'healthcare', label: 'Healthcare' }, { value: 'utilities', label: 'Utilities' },
    { value: 'education', label: 'Education' }, { value: 'travel', label: 'Travel' },
    { value: 'fitness', label: 'Fitness' }, { value: 'groceries', label: 'Groceries' },
    { value: 'dining', label: 'Dining' }, { value: 'fuel', label: 'Fuel' },
    { value: 'insurance', label: 'Insurance' }, { value: 'investment', label: 'Investment' },
    { value: 'charity', label: 'Charity' }, { value: 'personal_care', label: 'Personal Care' },
    { value: 'home', label: 'Home' }, { value: 'electronics', label: 'Electronics' },
    { value: 'clothing', label: 'Clothing' }, { value: 'books', label: 'Books' },
    { value: 'subscriptions', label: 'Subscriptions' }, { value: 'gifts', label: 'Gifts' },
    { value: 'taxi', label: 'Taxi' }, { value: 'other', label: 'Other' }, { value: 'total', label: 'Total' }
  ];

  const periodTypes = [
    { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' }
  ];

  const calculatePeriodDates = (type) => {
    const now = new Date();
    let startDate = new Date(now);
    let endDate = new Date(now);

    switch (type) {
      case 'daily':
        // Start of today, end of today
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        // Start of current week (Sunday), end of current week (Saturday)
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        // Start of current month, end of current month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(now.getMonth() + 1, 0); // Last day of current month
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'quarterly':
        // Start of current quarter, end of current quarter
        const currentMonth = now.getMonth();
        const startMonth = Math.floor(currentMonth / 3) * 3;
        startDate.setMonth(startMonth, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(startMonth + 3, 0); // Last day of last month in quarter
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yearly':
        // Start of current year, end of current year
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setMonth(11, 31);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        break;
    }
    return { startDate, endDate };
  };

  const fetchBudgets = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${BASE_URL}/api/budget`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setBudgets(data);
      } else {
        setError(data.message || 'Failed to fetch budgets.');
      }
    } catch (err) {
      setError('Network error or failed to fetch budgets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchBudgets();
    }
  }, [user]);

  const handleAddBudget = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }

      const { startDate, endDate } = calculatePeriodDates(periodType);

      const response = await fetch(`${BASE_URL}/api/budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name,
          category,
          amount: parseFloat(amount),
          period: {
            type: periodType,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
          },
          userId: user.uid // Pass Firebase UID
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess('Budget added successfully!');
        setName('');
        setAmount('');
        setCategory('food');
        setPeriodType('monthly');
        fetchBudgets(); // Refresh the list
      } else {
        setError(data.message || 'Failed to add budget.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="mb-8 text-4xl font-extrabold text-center text-gray-900 drop-shadow-sm">Budget Management</h1>

      <div className="max-w-3xl p-8 mx-auto mb-8 bg-white border border-gray-100 shadow-xl rounded-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Create New Budget</h2>
        {error && <ErrorMessage message={error} />}
        {success && <SuccessMessage message={success} />}
        <form onSubmit={handleAddBudget}>
          <InputField label="Budget Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Monthly Food" required />
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={categories} required />
          <InputField label="Amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g., 5000" required />
          <SelectField label="Period" value={periodType} onChange={(e) => setPeriodType(e.target.value)} options={periodTypes} required />
          <Button type="submit" className="w-full mt-4" disabled={loading}>
            {loading ? <LoadingSpinner /> : 'Create Budget'}
          </Button>
        </form>
      </div>

      <div className="max-w-3xl p-8 mx-auto bg-white border border-gray-100 shadow-xl rounded-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Your Budgets</h2>
        {loading ? (
          <LoadingSpinner />
        ) : budgets.length > 0 ? (
          <ul className="space-y-4">
            {budgets.map((budget) => (
              <li key={budget._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 transform hover:scale-[1.01] transition duration-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-base font-semibold text-gray-700">{budget.name} ({budget.category})</p>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium shadow-sm ${
                    budget.status === 'exceeded' ? 'bg-red-100 text-red-800' :
                    budget.status === 'critical' ? 'bg-orange-100 text-orange-800' :
                    budget.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {budget.status.charAt(0).toUpperCase() + budget.status.slice(1)}
                  </span>
                </div>
                <div className="w-full h-3 mb-2 overflow-hidden bg-gray-200 rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ease-out ${
                      budget.spentPercentage >= budget.alertThresholds.critical.percentage ? 'bg-red-500' :
                      budget.spentPercentage >= budget.alertThresholds.warning.percentage ? 'bg-orange-400' :
                      'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, budget.spentPercentage)}%` }}
                  ></div>
                </div>
                <p className="mt-1 text-sm text-gray-600">
                  Spent: <span className="font-bold">₹{budget.spent.toLocaleString()}</span> / ₹{budget.amount.toLocaleString()} ({budget.spentPercentage}%)
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Period: {new Date(budget.period.startDate).toLocaleDateString()} - {new Date(budget.period.endDate).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-gray-500">No budgets created yet.</p>
        )}
      </div>
    </div>
  );
};

// --- Goal Management Component ---

const GoalManagement = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('savings');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('medium');

  const goalTypes = [
    { value: 'savings', label: 'Savings' }, { value: 'expense_reduction', label: 'Expense Reduction' },
    { value: 'debt_payoff', label: 'Debt Payoff' }, { value: 'investment', label: 'Investment' },
    { value: 'emergency_fund', label: 'Emergency Fund' }, { value: 'vacation', label: 'Vacation' },
    { value: 'purchase', label: 'Purchase' }, { value: 'other', label: 'Other' }
  ];

  const priorities = [
    { value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
  ];

  const fetchGoals = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${BASE_URL}/api/goals`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setGoals(data);
      } else {
        setError(data.message || 'Failed to fetch goals.');
      }
    } catch (err) {
      setError('Network error or failed to fetch goals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchGoals();
    }
  }, [user]);

  const handleAddGoal = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${BASE_URL}/api/goals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          type,
          targetAmount: parseFloat(targetAmount),
          timeline: {
            startDate: new Date().toISOString(),
            targetDate: new Date(targetDate).toISOString(),
          },
          priority,
          userId: user.uid // Pass Firebase UID
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess('Goal added successfully!');
        setTitle('');
        setDescription('');
        setType('savings');
        setTargetAmount('');
        setTargetDate('');
        setPriority('medium');
        fetchGoals(); // Refresh the list
      } else {
        setError(data.message || 'Failed to add goal.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="mb-8 text-4xl font-extrabold text-center text-gray-900 drop-shadow-sm">Goal Management</h1>

      <div className="max-w-3xl p-8 mx-auto mb-8 bg-white border border-gray-100 shadow-xl rounded-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Create New Goal</h2>
        {error && <ErrorMessage message={error} />}
        {success && <SuccessMessage message={success} />}
        <form onSubmit={handleAddGoal}>
          <InputField label="Goal Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Save for Vacation" required />
          <InputField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value)} options={goalTypes} required />
          <InputField label="Target Amount" type="number" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} placeholder="e.g., 100000" required />
          <InputField label="Target Date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} required />
          <SelectField label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)} options={priorities} required />
          <Button type="submit" className="w-full mt-4" disabled={loading}>
            {loading ? <LoadingSpinner /> : 'Create Goal'}
          </Button>
        </form>
      </div>

      <div className="max-w-3xl p-8 mx-auto bg-white border border-gray-100 shadow-xl rounded-xl">
        <h2 className="mb-4 text-2xl font-bold text-gray-800">Your Goals</h2>
        {loading ? (
          <LoadingSpinner />
        ) : goals.length > 0 ? (
          <ul className="space-y-4">
            {goals.map((goal) => (
              <li key={goal._id} className="flex items-center justify-between p-3 transition duration-200 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100">
                <div>
                  <p className="text-base font-semibold text-gray-700">{goal.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {goal.category} - {new Date(goal.timeline.targetDate).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-lg font-bold text-green-600">₹{goal.currentAmount.toLocaleString()}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-4 text-center text-gray-500">No goals created yet.</p>
        )}
      </div>
    </div>
  );
};

// --- AI Chatbot Component ---
const AIChatbot = () => {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: "Hello! I'm your AI Financial Coach. How can I help you today?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth(); // Get Firebase user to pass UID

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (input.trim() === '') return;

    const userMessage = { sender: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }
      if (!user || !user.uid) {
        setError('User not authenticated. Please log in.');
        setLoading(false);
        return;
      }

      // Call your backend's AI service.
      // The backend would then call the Gemini API or other LLM.
      const response = await fetch(`${BASE_URL}/api/ai/chat`, { // Example API endpoint
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: input, userId: user.uid }), // Pass Firebase UID for personalized responses
      });

      const data = await response.json();

      if (response.ok) {
        setMessages((prev) => [...prev, { sender: 'ai', text: data.reply || "I'm still learning, please try another question!" }]);
      } else {
        setError(data.message || 'Failed to get a response from the AI coach.');
        setMessages((prev) => [...prev, { sender: 'ai', text: "Oops, something went wrong on my end. Please try again later." }]);
      }
    } catch (err) {
      setError('Network error. Could not connect to the AI coach.');
      setMessages((prev) => [...prev, { sender: 'ai', text: "I'm having trouble connecting right now. Please check your internet connection." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="mb-8 text-4xl font-extrabold text-center text-gray-900 drop-shadow-sm">AI Financial Coach</h1>

      <div className="max-w-xl mx-auto bg-white rounded-xl shadow-xl border border-gray-100 flex flex-col h-[70vh]">
        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] p-3 rounded-lg shadow-sm ${
                msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'
              }`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="max-w-[75%] p-3 rounded-lg bg-gray-200 text-gray-800">
                <LoadingSpinner />
              </div>
            </div>
          )}
          {error && <ErrorMessage message={error} />}
        </div>
        <form onSubmit={handleSendMessage} className="flex items-center p-4 border-t border-gray-200">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your financial coach..."
            className="flex-1 px-4 py-2 mr-2 transition duration-200 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={loading}
          />
          <Button type="submit" disabled={loading}>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Button>
        </form>
      </div>
    </div>
  );
};

// --- Emotional Spend Dashboard Component ---
const EmotionalSpendDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emotionalSpendData, setEmotionalSpendData] = useState([]); // Placeholder for data

  useEffect(() => {
    const fetchEmotionalData = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('Authentication token not found. Please log in.');
          setLoading(false);
          return;
        }
        if (!user || !user.uid) {
          setError('User not authenticated. Please log in.');
          setLoading(false);
          return;
        }

        // --- EMOTIONAL SPEND DATA API CALL FOR NEXT STEP ---
        // You'll need a backend endpoint to fetch emotional spending data.
        // This might involve aggregating expenses by mood, time of day, etc.
        const response = await fetch(`${BASE_URL}/api/analytics/emotional-spend/${user.uid}`, { // Example API endpoint
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();

        if (response.ok) {
          setEmotionalSpendData(data); // Set the actual data from backend
        } else {
          setError(data.message || 'Failed to fetch emotional spending data.');
        }
      } catch (err) {
        setError('Network error. Could not fetch emotional spending data.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchEmotionalData();
    }
  }, [user]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <h1 className="mb-8 text-4xl font-extrabold text-center text-gray-900 drop-shadow-sm">Emotional Spend Dashboard</h1>
      <div className="max-w-3xl p-8 mx-auto bg-white border border-gray-100 shadow-xl rounded-xl">
        <p className="mb-4 text-gray-700">
          This dashboard will show you insights into your spending habits linked to your emotional state.
          Tag your expenses with moods to see patterns emerge!
        </p>
        {emotionalSpendData.length > 0 ? (
          <div className="space-y-4">
            {/* Render your emotional spend charts/summaries here */}
            {emotionalSpendData.map((item, index) => (
              <div key={index} className="p-3 bg-gray-100 border border-gray-200 rounded-lg">
                <p className="font-semibold">{item.mood}: ₹{item.totalAmount.toLocaleString()} ({item.expenseCount} expenses)</p>
                <p className="text-sm text-gray-600">Average: ₹{(item.totalAmount / item.expenseCount).toFixed(2)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-gray-500">
            No emotional spending data available yet. Start tagging your expenses with moods!
          </p>
        )}
      </div>
    </div>
  );
};


// --- Settings Component ---
const Settings = () => {
  const [gmailEnabled, setGmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth(); // Get Firebase user to pass UID

  // Simulate fetching current settings
  useEffect(() => {
    setLoading(true);
    setError('');
    // In a real app, you'd fetch user settings from your backend
    // For now, load from localStorage or default
    const fetchUserSettings = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || !user) {
          // If no token or user, use localStorage defaults
          setGmailEnabled(localStorage.getItem('gmailEnabled') === 'true');
          setSmsEnabled(localStorage.getItem('smsEnabled') === 'true');
          setEmailNotifications(localStorage.getItem('emailNotifications') !== 'false');
          setPushNotifications(localStorage.getItem('pushNotifications') !== 'false');
          setDarkMode(localStorage.getItem('theme') === 'dark');
          setLoading(false);
          return;
        }

        // Attempt to fetch from backend
        const response = await fetch(`${BASE_URL}/api/users/settings/${user.uid}`, { // Example API endpoint with user ID
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        if (response.ok) {
          setGmailEnabled(data.integrations?.gmail?.enabled || false);
          setSmsEnabled(data.integrations?.sms?.enabled || false);
          setEmailNotifications(data.preferences?.notifications?.email || true);
          setPushNotifications(data.preferences?.notifications?.push || true);
          setDarkMode(data.preferences?.theme === 'dark');
          localStorage.setItem('gmailEnabled', data.integrations?.gmail?.enabled);
          localStorage.setItem('smsEnabled', data.integrations?.sms?.enabled);
          localStorage.setItem('emailNotifications', data.preferences?.notifications?.email);
          localStorage.setItem('pushNotifications', data.preferences?.notifications?.push);
          localStorage.setItem('theme', data.preferences?.theme);
        } else {
          setError(data.message || 'Failed to fetch settings from backend.');
          // Fallback to localStorage if backend fetch fails
          setGmailEnabled(localStorage.getItem('gmailEnabled') === 'true');
          setSmsEnabled(localStorage.getItem('smsEnabled') === 'true');
          setEmailNotifications(localStorage.getItem('emailNotifications') !== 'false');
          setPushNotifications(localStorage.getItem('pushNotifications') !== 'false');
          setDarkMode(localStorage.getItem('theme') === 'dark');
        }
      } catch (err) {
        setError('Network error or failed to fetch settings.');
        // Fallback to localStorage if network error
        setGmailEnabled(localStorage.getItem('gmailEnabled') === 'true');
        setSmsEnabled(localStorage.getItem('smsEnabled') === 'true');
        setEmailNotifications(localStorage.getItem('emailNotifications') !== 'false');
        setPushNotifications(localStorage.getItem('pushNotifications') !== 'false');
        setDarkMode(localStorage.getItem('theme') === 'dark');
      } finally {
        setLoading(false);
      }
    };

    if (user) { // Only fetch if Firebase user is available
      fetchUserSettings();
    }
  }, [user]); // Depend on user to refetch when auth state changes

  const handleSaveSettings = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setLoading(false);
        return;
      }
      if (!user || !user.uid) {
        setError('User not authenticated. Please log in.');
        setLoading(false);
        return;
      }

      // Call your backend to save user preferences.
      const response = await fetch(`${BASE_URL}/api/users/settings`, { // Example API endpoint
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          integrations: { gmail: { enabled: gmailEnabled }, sms: { enabled: smsEnabled } },
          preferences: {
            notifications: { email: emailNotifications, push: pushNotifications },
            theme: darkMode ? 'dark' : 'light'
          },
          userId: user.uid // Pass Firebase UID
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess('Settings saved successfully!');
        // Update localStorage to reflect saved settings immediately
        localStorage.setItem('gmailEnabled', gmailEnabled);
        localStorage.setItem('smsEnabled', smsEnabled);
        localStorage.setItem('emailNotifications', emailNotifications);
        localStorage.setItem('pushNotifications', pushNotifications);
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        // Apply dark mode immediately
        document.documentElement.classList.toggle('dark', darkMode);
      } else {
        setError(data.message || 'Failed to save settings.');
      }
    } catch (err) {
      setError('Network error. Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 text-gray-900 transition-colors duration-300 bg-gray-50 dark:bg-gray-900 dark:text-gray-100">
      <h1 className="mb-8 text-4xl font-extrabold text-center drop-shadow-sm">Settings</h1>

      <div className="max-w-3xl p-8 mx-auto bg-white border border-gray-100 shadow-xl dark:bg-gray-800 rounded-xl dark:border-gray-700">
        {error && <ErrorMessage message={error} />}
        {success && <SuccessMessage message={success} />}
        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            <section className="pb-8 mb-8 border-b border-gray-200 dark:border-gray-700">
              <h2 className="flex items-center mb-4 text-2xl font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Integrations
              </h2>
              <div className="flex items-center justify-between mb-4">
                <label htmlFor="gmail" className="text-lg font-medium">Auto-fetch from Gmail</label>
                <input
                  type="checkbox"
                  id="gmail"
                  checked={gmailEnabled}
                  onChange={(e) => setGmailEnabled(e.target.checked)}
                  className="w-6 h-6 text-blue-600 transition duration-150 ease-in-out rounded-md form-checkbox focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="sms" className="text-lg font-medium">SMS Parsing</label>
                <input
                  type="checkbox"
                  id="sms"
                  checked={smsEnabled}
                  onChange={(e) => setSmsEnabled(e.target.checked)}
                  className="w-6 h-6 text-blue-600 transition duration-150 ease-in-out rounded-md form-checkbox focus:ring-blue-500"
                />
              </div>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Enabling these integrations allows FinTrack to automatically parse transaction details from your emails and SMS messages.
                (Requires backend setup for OAuth/permissions)
              </p>
            </section>

            <section className="pb-8 mb-8 border-b border-gray-200 dark:border-gray-700">
              <h2 className="flex items-center mb-4 text-2xl font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17v2a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2h2m2 4l4-4m-4 4L9 19m4-4H9m7 4v-2a2 2 0 00-2-2h-2" />
                </svg>
                Notifications
              </h2>
              <div className="flex items-center justify-between mb-4">
                <label htmlFor="email-notifs" className="text-lg font-medium">Email Notifications</label>
                <input
                  type="checkbox"
                  id="email-notifs"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="w-6 h-6 text-blue-600 transition duration-150 ease-in-out rounded-md form-checkbox focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center justify-between">
                <label htmlFor="push-notifs" className="text-lg font-medium">Push Notifications</label>
                <input
                  type="checkbox"
                  id="push-notifs"
                  checked={pushNotifications}
                  onChange={(e) => setPushNotifications(e.target.checked)}
                  className="w-6 h-6 text-blue-600 transition duration-150 ease-in-out rounded-md form-checkbox focus:ring-blue-500"
                />
              </div>
            </section>

            <section className="pb-8 mb-8 border-b border-gray-200 dark:border-gray-700">
              <h2 className="flex items-center mb-4 text-2xl font-bold">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mr-2 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9 9 0 008.354-5.646z" />
                </svg>
                Appearance
              </h2>
              <div className="flex items-center justify-between">
                <label htmlFor="dark-mode" className="text-lg font-medium">Dark Mode</label>
                <input
                  type="checkbox"
                  id="dark-mode"
                  checked={darkMode}
                  onChange={(e) => setDarkMode(e.target.checked)}
                  className="w-6 h-6 text-blue-600 transition duration-150 ease-in-out rounded-md form-checkbox focus:ring-blue-500"
                />
              </div>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Toggle between light and dark themes for a personalized viewing experience.
              </p>
            </section>

            <Button onClick={handleSaveSettings} className="w-full" disabled={loading}>
              {loading ? <LoadingSpinner /> : 'Save Settings'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};


// --- Main App Component ---

function App() {
  const { isAuthenticated, loadingAuth, user, auth } = useAuth();
  const [currentView, setCurrentView] = useState('login');
  const [anomalyAlert, setAnomalyAlert] = useState(null); // State to hold anomaly alert

  useEffect(() => {
    if (!loadingAuth) {
      if (isAuthenticated) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('login');
      }
    }
  }, [isAuthenticated, loadingAuth]);

  // Apply dark mode based on localStorage on initial load
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Socket.IO for real-time anomaly alerts
  useEffect(() => {
    let socket;
    if (isAuthenticated && user?.uid) {
      // Connect to Socket.IO backend
      socket = io(SOCKET_URL);

      socket.on('connect', () => {
        console.log('Socket.IO connected:', socket.id);
        socket.emit('joinRoom', user.uid); // Join a room specific to the user's Firebase UID
      });

      socket.on('anomalyAlert', (alertData) => {
        console.log('Received Anomaly Alert:', alertData);
        setAnomalyAlert(alertData); // Set the alert data to state
        // You might want to auto-dismiss this after a few seconds
        setTimeout(() => setAnomalyAlert(null), 10000); // Dismiss after 10 seconds
      });

      socket.on('disconnect', () => {
        console.log('Socket.IO disconnected.');
      });

      return () => {
        if (socket) {
          socket.disconnect(); // Disconnect on component unmount or user logout
        }
      };
    }
  }, [isAuthenticated, user]); // Re-run effect when auth status or user changes


  const handleLogout = async () => {
    localStorage.removeItem('token'); // Clear backend token
    if (auth) {
      await signOut(auth); // Sign out from Firebase
    }
    setCurrentView('login');
  };

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans antialiased text-gray-800 transition-colors duration-300 bg-gray-100 dark:bg-gray-900 dark:text-gray-100">
      {/* Tailwind CSS CDN */}
      <script src="https://cdn.tailwindcss.com"></script>
      {/* Font for better aesthetics */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>
        {`
          body {
            font-family: 'Inter', sans-serif;
          }
          .animate-fade-in {
            animation: fadeIn 0.5s ease-out forwards;
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          /* Basic styling for checkbox to make it look better with Tailwind */
          .form-checkbox {
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            display: inline-block;
            height: 1.5rem; /* h-6 */
            width: 1.5rem;  /* w-6 */
            cursor: pointer;
            border-radius: 0.375rem; /* rounded-md */
            border: 2px solid #D1D5DB; /* gray-300 */
            background-color: #FFFFFF; /* white */
            transition: background-color 0.2s, border-color 0.2s;
          }
          .form-checkbox:checked {
            background-color: #2563EB; /* blue-600 */
            border-color: #2563EB; /* blue-600 */
            background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 00-1.414 0L7 8.586 5.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4a1 1 0 000-1.414z'/%3e%3c/svg%3e");
            background-size: 100% 100%;
            background-position: center;
            background-repeat: no-repeat;
          }
          .form-checkbox:focus {
            outline: none;
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.5); /* ring-blue-500 with opacity */
          }
          /* Dark mode specific styles */
          .dark .form-checkbox {
            border-color: #4B5563; /* gray-600 */
            background-color: #1F2937; /* gray-800 */
          }
          .dark .form-checkbox:checked {
            background-color: #3B82F6; /* blue-500 */
            border-color: #3B82F6; /* blue-500 */
          }
        `}
      </style>

      {/* Anomaly Alert Toast/Banner */}
      {anomalyAlert && (
        <div className="fixed z-50 p-4 text-white bg-yellow-500 rounded-lg shadow-xl top-4 right-4 animate-fade-in">
          <p className="font-bold">🚨 Anomaly Alert!</p>
          <p className="text-sm">{anomalyAlert.message}</p>
          <button onClick={() => setAnomalyAlert(null)} className="absolute text-white opacity-75 top-1 right-1 hover:opacity-100">
            &times;
          </button>
        </div>
      )}

      {isAuthenticated && (
        <nav className="sticky top-0 z-50 flex flex-col items-center justify-between p-4 transition-colors duration-300 bg-white border-b border-gray-200 shadow-lg dark:bg-gray-800 sm:flex-row dark:border-gray-700">
          <div className="mb-4 text-3xl font-extrabold text-blue-700 dark:text-blue-400 sm:mb-0">FinTrack</div>
          <div className="flex flex-wrap justify-center mb-4 space-x-2 sm:justify-start sm:space-x-4 sm:mb-0">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-4 py-2 rounded-full font-medium transition duration-300 ease-in-out transform hover:scale-105
                ${currentView === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400'}
              `}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentView('expenses')}
              className={`px-4 py-2 rounded-full font-medium transition duration-300 ease-in-out transform hover:scale-105
                ${currentView === 'expenses' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400'}
              `}
            >
              Expenses
            </button>
            <button
              onClick={() => setCurrentView('budgets')}
              className={`px-4 py-2 rounded-full font-medium transition duration-300 ease-in-out transform hover:scale-105
                ${currentView === 'budgets' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400'}
              `}
            >
              Budgets
            </button>
            <button
              onClick={() => setCurrentView('goals')}
              className={`px-4 py-2 rounded-full font-medium transition duration-300 ease-in-out transform hover:scale-105
                ${currentView === 'goals' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400'}
              `}
            >
              Goals
            </button>
            <button
              onClick={() => setCurrentView('ai-coach')}
              className={`px-4 py-2 rounded-full font-medium transition duration-300 ease-in-out transform hover:scale-105
                ${currentView === 'ai-coach' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400'}
              `}
            >
              AI Coach
            </button>
            <button
              onClick={() => setCurrentView('emotional-insights')}
              className={`px-4 py-2 rounded-full font-medium transition duration-300 ease-in-out transform hover:scale-105
                ${currentView === 'emotional-insights' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400'}
              `}
            >
              Emotional Insights
            </button>
            <button
              onClick={() => setCurrentView('settings')}
              className={`px-4 py-2 rounded-full font-medium transition duration-300 ease-in-out transform hover:scale-105
                ${currentView === 'settings' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 hover:text-blue-700 dark:hover:text-blue-400'}
              `}
            >
              Settings
            </button>
          </div>
          <Button onClick={handleLogout} className="bg-red-500 shadow-md hover:bg-red-600">Logout</Button>
        </nav>
      )}

      <div className="container p-4 mx-auto">
        {!isAuthenticated ? (
          currentView === 'login' ? (
            <LoginForm onLoginSuccess={() => setCurrentView('dashboard')} onSwitchToRegister={() => setCurrentView('register')} />
          ) : (
            <RegisterForm onRegisterSuccess={() => setCurrentView('login')} onSwitchToLogin={() => setCurrentView('login')} />
          )
        ) : (
          <>
            {currentView === 'dashboard' && <Dashboard />}
            {currentView === 'expenses' && <ExpenseManagement />}
            {currentView === 'budgets' && <BudgetManagement />}
            {currentView === 'goals' && <GoalManagement />}
            {currentView === 'ai-coach' && <AIChatbot />}
            {currentView === 'emotional-insights' && <EmotionalSpendDashboard />}
            {currentView === 'settings' && <Settings />}
          </>
        )}
      </div>
    </div>
  );
}

// Wrap the App component with AuthProvider
export default function WrappedApp() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
