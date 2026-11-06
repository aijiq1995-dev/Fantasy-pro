/* سجل الأقسام: كل قسم = دالة ترجع HTML + دالة اختيارية بعد الرسم */
import { vHome, afterHome } from './home.js';
import { vTeam } from './team.js';
import { vPlayers, afterPlayers, vMarket, vCompare, afterCompare } from './players.js';
import { vLive, afterLive } from './live.js';
import { vLeagues } from './leagues.js';
import { vChips } from './chips.js';
import { vStats, vAchievements } from './stats.js';
import { vSearch, afterSearch } from './search.js';
import { vSeason, afterSeason } from './season.js';
import { vLab } from './lab.js';
import { vPrices } from './prices.js';
import { vNotifs, vSettings, vMore } from './notifs.js';
import { vAdmin } from './admin.js';
import './common.js';
export const VIEWS = { home: vHome, team: vTeam, players: vPlayers, market: vMarket, compare: vCompare, live: vLive, leagues: vLeagues, chips: vChips, stats: vStats, search: vSearch, season: vSeason, lab: vLab, prices: vPrices, achievements: vAchievements, notifs: vNotifs, settings: vSettings, admin: vAdmin, more: vMore };
export const AFTER = { home: afterHome, players: afterPlayers, compare: afterCompare, live: afterLive, search: afterSearch, season: afterSeason };
export { startLivePolling } from './live.js';
