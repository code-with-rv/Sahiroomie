import { createSahiroomieApp, safeErrorHandler } from '../src/serverApp.js';

const app = createSahiroomieApp();
app.use(safeErrorHandler);

export default app;
