import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { SurveyPage } from '@/respondent/SurveyPage';

// The admin area is loaded on demand so respondents never download it (incl. the chart library).
const AdminLayout = lazy(() => import('@/admin/AdminLayout'));
const LoginPage = lazy(() => import('@/admin/LoginPage'));
const SurveysPage = lazy(() => import('@/admin/SurveysPage'));
const SurveyBuilderPage = lazy(() => import('@/admin/builder/SurveyBuilderPage'));

const lazyPage = (page: React.ReactNode) => <Suspense fallback={null}>{page}</Suspense>;

export const routes: RouteObject[] = [
  // The real respondent survey: the entry link (/s/…) redirects here after setting the session.
  { path: '/survey', element: <SurveyPage /> },

  // Admin area.
  { path: '/admin/login', element: lazyPage(<LoginPage />) },
  {
    path: '/admin',
    element: lazyPage(<AdminLayout />),
    children: [
      { index: true, element: <SurveysPage /> },
      { path: 'surveys/:id', element: <SurveyBuilderPage /> },
    ],
  },

  { path: '*', element: <Navigate to="/admin" replace /> },
];
