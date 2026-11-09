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

// The admin area is loaded on demand so respondents never download it (incl. the chart library).
const AdminLayout = lazy(() => import('@/prototype/admin/AdminLayout'));
const SurveyList = lazy(() => import('@/prototype/admin/SurveyList'));
const Dashboard = lazy(() => import('@/prototype/admin/Dashboard'));

export const routes: RouteObject[] = [
  { path: '/', element: <PrototypeIndex /> },
  {
    path: '/survey',
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
    path: '/admin',
    element: (
      <Suspense fallback={null}>
        <AdminLayout />
      </Suspense>
    ),
    children: [
      { index: true, element: <Navigate to="surveys" replace /> },
      { path: 'surveys', element: <SurveyList /> },
      { path: 'dashboard', element: <Dashboard /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
];
