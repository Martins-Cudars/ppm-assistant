// Full Player Table - Extension Page Script
// Uses chrome.storage.local to display cached player data

// Load cached player data using chrome.storage.local
async function loadData() {
  try {
    // Get all keys from chrome.storage.local
    const allData = await chrome.storage.local.get(null);
    console.log('[FullPlayerTable] All storage keys:', Object.keys(allData));

    // Find the storage key for hockey team data
    const storageKey = Object.keys(allData).find(k => k.startsWith('ppm-assistant:hockey:team-'));
    console.log('[FullPlayerTable] Storage key:', storageKey);

    if (!storageKey) {
      showEmptyState('No cached data found. Visit your team pages to collect player data.');
      return;
    }

    const cache = allData[storageKey];
    console.log('[FullPlayerTable] Cache data:', cache);

    if (!cache || !cache.players) {
      console.error('[FullPlayerTable] No cache or no players in cache');
      showEmptyState('No cached data found. Visit your team pages to collect player data.');
      return;
    }

    const players = Object.values(cache.players || {});
    console.log('[FullPlayerTable] Players array:', players);
    console.log('[FullPlayerTable] First player sample:', players[0]);

    if (players.length === 0) {
      console.error('[FullPlayerTable] Players array is empty');
      showEmptyState('No players in cache. Visit PlayersList or PlayerProfile pages to collect data.');
      return;
    }

    console.log('[FullPlayerTable] About to display', players.length, 'players');
    displayPlayers(players);
    document.getElementById('info').textContent = `Showing ${players.length} cached players`;
    console.log('[FullPlayerTable] Display complete');
  } catch (e) {
    console.error('[FullPlayerTable] Error loading data:', e);
    showEmptyState('Error loading cache: ' + e.message);
  }
}

// Display players in table
function displayPlayers(players) {
  try {
    console.log('[FullPlayerTable] displayPlayers called with', players.length, 'players');
    const now = new Date();

    const html = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Age</th>
            <th>Overall Rating</th>
            <th>Experience</th>
            <th>Freshness</th>
            <th>Last Updated</th>
            <th>Data Source</th>
            <th>Completeness</th>
          </tr>
        </thead>
        <tbody>
          ${players.map(p => {
            console.log('[FullPlayerTable] Rendering player:', p.baseInfo?.name || 'unknown');
            const updatedAt = new Date(p.metadata.updatedAt);
            const daysDiff = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));

            let freshnessClass = 'fresh';
            let freshnessLabel = 'Fresh';
            if (daysDiff > 7) {
              freshnessClass = 'very-stale';
              freshnessLabel = `${daysDiff}d old`;
            } else if (daysDiff > 1) {
              freshnessClass = 'stale';
              freshnessLabel = `${daysDiff}d old`;
            } else if (daysDiff === 1) {
              freshnessClass = 'stale';
              freshnessLabel = '1d old';
            } else {
              freshnessLabel = 'Today';
            }

            const playerUrl = `https://hockey.powerplaymanager.com/en/player.html?data=${p.baseInfo.id}`;

            return `
              <tr>
                <td><a href="${playerUrl}" class="player-link" target="_blank">${p.baseInfo.name}</a></td>
                <td>${p.baseInfo.age}</td>
                <td>${p.baseInfo.overallRating}</td>
                <td>${p.experience !== null ? p.experience : 'N/A'}</td>
                <td><span class="freshness-badge ${freshnessClass}">${freshnessLabel}</span></td>
                <td>${updatedAt.toLocaleString()}</td>
                <td>${p.metadata.lastViewSource}</td>
                <td>${p.metadata.dataCompleteness}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    console.log('[FullPlayerTable] Setting innerHTML with table HTML');
    document.getElementById('content').innerHTML = html;
    console.log('[FullPlayerTable] Table rendered successfully');
  } catch (e) {
    console.error('[FullPlayerTable] Error in displayPlayers:', e);
    console.error('[FullPlayerTable] Error stack:', e.stack);
    showEmptyState('Error rendering table: ' + e.message);
  }
}

// Show empty state message
function showEmptyState(message) {
  document.getElementById('content').innerHTML = `
    <div class="empty-state">
      <h2>📭 No Data Available</h2>
      <p>${message}</p>
    </div>
  `;
  document.getElementById('info').textContent = '';
}

// Clear cache using chrome.storage.local
async function clearCache() {
  if (!confirm('Are you sure you want to clear all cached player data? This cannot be undone.')) {
    return;
  }

  try {
    // Get all keys and find hockey team data
    const allData = await chrome.storage.local.get(null);
    const storageKey = Object.keys(allData).find(k => k.startsWith('ppm-assistant:hockey:team-'));

    if (storageKey) {
      await chrome.storage.local.remove(storageKey);
      console.log('[FullPlayerTable] Cache cleared:', storageKey);
    }

    showEmptyState('Cache cleared successfully.');
  } catch (e) {
    console.error('[FullPlayerTable] Error clearing cache:', e);
    showEmptyState('Error clearing cache: ' + e.message);
  }
}

// Attach event handlers after DOM loads
window.addEventListener('DOMContentLoaded', () => {
  // Load data on page load
  loadData();

  // Note: Button click handlers are defined in HTML with onclick attributes
  // which will call these global functions
});
