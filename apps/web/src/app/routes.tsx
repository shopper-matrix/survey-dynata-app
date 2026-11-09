import { lazy, Suspense } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { PrototypeIndex } from '@/prototype/PrototypeIndex';
import { EndScreen } from '@/prototype/respondent/EndScreen';
import { GridQuestion } from '@/prototype/respondent/questions/GridQuestion';
import { MultiChoiceQuestion } from '@/prototype/respondent/questions/MultiChoiceQuestion';
import { NumberQuestion } from '@/prototype/respondent/questions/NumberQuestion';
import { OpenTextQuestion } from '@/prototype/respondent/questions/OpenTextQuestion';
import { RatingQuestion } from '@/prototype/respondent/questions/RatingQuestion';
import { SingleChoiceQuestion } from '@/prototype/respondent/questions/SingleChoiceQuestion';
import { WelcomeScreen } from '@/prototype/respondent/WelcomeScreen';
import { SurveyPage } from '@/respondent/SurveyPage';

// The admin area is loaded on demand so respondents never download it (incl. the chart library).
const AdminLayout = lazy(() => import('@/admin/AdminLayout'));
const LoginPage = lazy(() => import('@/admin/LoginPage'));
const SurveysPage = lazy(() => import('@/admin/SurveysPage'));
const SurveyBuilderPage = lazy(() => import('@/admin/builder/SurveyBuilderPage'));
const PrototypeAdminLayout = lazy(() => import('@/prototype/admin/AdminLayout'));
const PrototypeSurveyList = lazy(() => import('@/prototype/admin/SurveyList'));
const PrototypeDashboard = lazy(() => import('@/prototype/admin/Dashboard'));

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

  // UI prototype (DSA-105), the design reference until every screen has a real counterpart.
  { path: '/prototype', element: <PrototypeIndex /> },
  {
    path: '/prototype/survey',
    children: [
      { index: true, element: <Navigate to="welcome" replace /> },
      { path: 'welcome', element: <WelcomeScreen /> },
      { path: 'single', element: <SingleChoiceQuestion /> },
      { path: 'multi', element: <MultiChoiceQuestion /> },
      { path: 'grid', element: <GridQuestion /> },
      { path: 'open', element: <OpenTextQuestion /> },
      { path: 'number', element: <NumberQuestion /> },
      { path: 'rating', element: <RatingQuestion /> },
      { path: 'end/complete', element: <EndScreen outcome="complete" /> },
      { path: 'end/screenout', element: <EndScreen outcome="screenout" /> },
    ],
  },
  {
    path: '/prototype/admin',
    element: lazyPage(<PrototypeAdminLayout />),
    children: [
      { index: true, element: <Navigate to="surveys" replace /> },
      { path: 'surveys', element: <PrototypeSurveyList /> },
      { path: 'dashboard', element: <PrototypeDashboard /> },
    ],
  },
  { path: '*', element: <Navigate to="/admin" replace /> },
];
