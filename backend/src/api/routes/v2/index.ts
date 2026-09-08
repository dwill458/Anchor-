import { Router } from 'express';
import visionRoutes from './visionRoutes';
import anchorLifecycleRoutes from './anchorLifecycleRoutes';
import recommendationRoutes from './recommendationRoutes';

const v2Router = Router();

// Keep the canonical V2 billing/thread route modules exported for their
// dedicated mounts in the application entry point. New V2 domains compose
// into the same namespace without replacing those mounts.
export { default as v2BillingRoutes } from './billing';
export { default as v2ThreadRoutes } from './thread';

v2Router.use('/', visionRoutes);
v2Router.use('/', anchorLifecycleRoutes);
v2Router.use('/', recommendationRoutes);

export default v2Router;
