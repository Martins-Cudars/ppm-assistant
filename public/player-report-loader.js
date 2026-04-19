// Player Report Loader - loads the Vue app from built module
// This loads the playerReport.js ES module built by Vite
import('./playerReport.js')
  .then(() => {
    console.log('[PlayerReport] Module loaded successfully');
  })
  .catch((error) => {
    console.error('[PlayerReport] Failed to load module:', error);
    document.getElementById('app').innerHTML = `
      <div style="padding: 40px; text-align: center; color: #dc3545;">
        <h2>Failed to load Player Report</h2>
        <p>Error: ${error.message}</p>
        <p style="margin-top: 20px; font-size: 14px; color: #666;">
          Check the browser console for more details.
        </p>
      </div>
    `;
  });
