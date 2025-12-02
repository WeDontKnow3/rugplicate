const API_BASE = import.meta.env.VITE_API_BASE || "";

function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

function authHeaders(){
  const t = getCookie("token") || localStorage.getItem("token");
  return t ? { Authorization: "Bearer " + t } : {};
}

async function safeJson(res){
  try{
    return await res.json();
  }catch(e){
    return { error: "invalid_json_response", message: e.message };
  }
}

export async function register(username, password, captchaToken, adminSecret = null){
  try{
    const body = { username, password, captcha: captchaToken };
    if (adminSecret) body.adminSecret = adminSecret;
    const res = await fetch(`${API_BASE}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getDailyStatus(){
  try{
    const res = await fetch(`${API_BASE}/api/daily/status`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function claimDailyReward(){
  try{
    const res = await fetch(`${API_BASE}/api/daily/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function login(username, password){
  try{
    const res = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminUpdateUserBalance(userId, balance) {
  try{
    const res = await fetch(`${API_BASE}/api/admin/users/${userId}/balance`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ balance })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getMe(){
  try{
    const res = await fetch(`${API_BASE}/api/me`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getCoinHolders(symbol){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}/holders`, {
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function listCoins(){
  try{
    const res = await fetch(`${API_BASE}/api/coins`, {
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getCoin(symbol){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}`, {
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getCoinHistory(symbol, hours = 24){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}/history?hours=${Number(hours)}`, {
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function createCoin(payload){
  try{
    const res = await fetch(`${API_BASE}/api/coins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function buyCoin(symbol, usdAmount) {
  try {
    const res = await fetch(`${API_BASE}/api/trade/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ symbol, usdAmount }), 
    });
    return await safeJson(res);
  } catch (e) {
    return { error: e.message || "network_error" };
  }
}

export async function sellCoin(symbol, tokenAmount) {
  try {
    const res = await fetch(`${API_BASE}/api/trade/sell`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ symbol, tokenAmount }), 
    });
    return await safeJson(res);
  } catch (e) {
    return { error: e.message || "network_error" };
  }
}

export async function getTransactions(){
  try{
    const res = await fetch(`${API_BASE}/api/transactions`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function listAvailablePromoCodes(){
  try{
    const res = await fetch(`${API_BASE}/api/promocodes/available`, {
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function redeemPromoCode(code){
  try{
    const res = await fetch(`${API_BASE}/api/promocodes/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ code })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function createPromoCode(payload){
  try{
    const res = await fetch(`${API_BASE}/api/promocodes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminUpdatePromoCode(id, payload){
  try{
    const res = await fetch(`${API_BASE}/api/admin/promocodes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function createApiKey(name){
  try{
    const res = await fetch(`${API_BASE}/api/apikeys`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ name })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function listApiKeys(){
  try{
    const res = await fetch(`${API_BASE}/api/apikeys`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function deleteApiKey(id){
  try{
    const res = await fetch(`${API_BASE}/api/apikeys/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function resetApiKeyUsage(id){
  try{
    const res = await fetch(`${API_BASE}/api/apikeys/${id}/reset`, {
      method: "POST",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListPromoCodes(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/promocodes`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListPromoRedemptions(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/promocodes/redemptions`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminGetDB(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/db`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminReplaceDB(payload){
  try{
    const res = await fetch(`${API_BASE}/api/admin/db`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListUsers(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/users`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminBanUser(id, ban){
  try{
    const res = await fetch(`${API_BASE}/api/admin/users/${id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ ban: !!ban })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminDeleteUser(id){
  try{
    const res = await fetch(`${API_BASE}/api/admin/users/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListCoins(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/coins`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminDeleteCoin(id){
  try{
    const res = await fetch(`${API_BASE}/api/admin/coins/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminUpdateCoin(id, payload){
  try{
    const res = await fetch(`${API_BASE}/api/admin/coins/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getLeaderboard(timeframe = "all"){
  try{
    const res = await fetch(`${API_BASE}/api/leaderboard?timeframe=${encodeURIComponent(timeframe)}`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function coinFlip(bet, side = 'heads'){
  try{
    const res = await fetch(`${API_BASE}/api/gambling/coinflip`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ bet: Number(bet), side: String(side) })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function playSlots(bet){
  try{
    const res = await fetch(`${API_BASE}/api/gambling/slots`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ bet: Number(bet) })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getCoinComments(symbol){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}/comments`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function postCoinComment(symbol, text){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ text })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function deleteCoinComment(commentId){
  try{
    const res = await fetch(`${API_BASE}/api/coins/comments/${commentId}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function transferAssets(payload){
  try{
    const res = await fetch(`${API_BASE}/api/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getNotifications(){
  try{
    const res = await fetch(`${API_BASE}/api/notifications`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getUnreadNotificationCount(){
  try{
    const res = await fetch(`${API_BASE}/api/notifications/unread-count`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function markNotificationRead(id){
  try{
    const res = await fetch(`${API_BASE}/api/notifications/${id}/read`, {
      method: "POST",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function markAllNotificationsRead(){
  try{
    const res = await fetch(`${API_BASE}/api/notifications/read-all`, {
      method: "POST",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function deleteNotification(id){
  try{
    const res = await fetch(`${API_BASE}/api/notifications/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminSendGlobalNotification(payload){
  try{
    const res = await fetch(`${API_BASE}/api/admin/notifications/global`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getApiLatencyStats(){
  try{
    const res = await fetch(`${API_BASE}/api/stats/latency`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getApiUptimeStats(){
  try{
    const res = await fetch(`${API_BASE}/api/stats/uptime`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getUserStats(){
  try{
    const res = await fetch(`${API_BASE}/api/user/stats`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getPortfolioPnL(){
  try{
    const res = await fetch(`${API_BASE}/api/portfolio/pnl`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function analyzeHopiumQuestion(question){
  try{
    const res = await fetch(`${API_BASE}/api/hopium/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ question })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function createHopiumQuestion(payload){
  try{
    const res = await fetch(`${API_BASE}/api/hopium/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function listHopiumQuestions(){
  try{
    const res = await fetch(`${API_BASE}/api/hopium/questions`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function voteHopiumQuestion(questionId, vote, amount){
  try{
    const res = await fetch(`${API_BASE}/api/hopium/questions/${questionId}/vote`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ vote, amount })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function minesStart(bet, bombs){
  try{
    const res = await fetch(`${API_BASE}/api/gambling/mines/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ bet: Number(bet), bombs: Number(bombs) })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function minesReveal(gameId, index){
  try{
    const res = await fetch(`${API_BASE}/api/gambling/mines/reveal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ gameId, index: Number(index) })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function minesCashout(gameId){
  try{
    const res = await fetch(`${API_BASE}/api/gambling/mines/cashout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({ gameId })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function listNews(){
  try{
    const res = await fetch(`${API_BASE}/api/news`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getUserSettings(){
  try{
    const res = await fetch(`${API_BASE}/api/user/settings`, { 
      headers: { ...authHeaders() },
      credentials: "include"
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function updateUserSettings(settings){
  try{
    const res = await fetch(`${API_BASE}/api/user/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(settings)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}
