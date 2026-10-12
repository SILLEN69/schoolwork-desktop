// Isolated test fixture; this loader is never shipped with the application.
global.__pointerLoad=modulePath=>new(require(modulePath).DesktopPointer)();
require('./test-lesson-app.cjs');
