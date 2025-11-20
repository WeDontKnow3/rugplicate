const API_BASE = import.meta.env.VITE_API_BASE || "https://devsite-backend-production.up.railway.app";

function authHeaders(){
  const t = localStorage.getItem("token");
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
      body: JSON.stringify(body)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getDailyStatus(){
  try{
    const res = await fetch(`${API_BASE}/api/daily/status`, { headers: { ...authHeaders() } });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function claimDailyReward(){
  try{
    const res = await fetch(`${API_BASE}/api/daily/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() }
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
      body: JSON.stringify({ balance })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getMe(){
  try{
    const res = await fetch(`${API_BASE}/api/me`, { headers: { ...authHeaders() } });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getCoinHolders(symbol){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}/holders`);
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function listCoins(){
  try{
    const res = await fetch(`${API_BASE}/api/coins`);
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getCoin(symbol){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}`);
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getCoinHistory(symbol, hours = 24){
  try{
    const res = await fetch(`${API_BASE}/api/coins/${encodeURIComponent(symbol)}/history?hours=${Number(hours)}`);
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
      body: JSON.stringify({ symbol, tokenAmount }), 
    });
    return await safeJson(res);
  } catch (e) {
    return { error: e.message || "network_error" };
  }
}

export async function getTransactions(){
  try{
    const res = await fetch(`${API_BASE}/api/transactions`, { headers: { ...authHeaders() } });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function listAvailablePromoCodes(){
  try{
    const res = await fetch(`${API_BASE}/api/promocodes/available`);
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
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListPromoCodes(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/promocodes`, { headers: { ...authHeaders() } });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListPromoRedemptions(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/promocodes/redemptions`, { headers: { ...authHeaders() } });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminGetDB(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/db`, { headers: { ...authHeaders() } });
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
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListUsers(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/users`, { headers: { ...authHeaders() } });
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
      headers: { ...authHeaders() }
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminListCoins(){
  try{
    const res = await fetch(`${API_BASE}/api/admin/coins`, { headers: { ...authHeaders() } });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function adminDeleteCoin(id){
  try{
    const res = await fetch(`${API_BASE}/api/admin/coins/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() }
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
      body: JSON.stringify(payload)
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}

export async function getLeaderboard(timeframe = "all"){
  try{
    const res = await fetch(`${API_BASE}/api/leaderboard?timeframe=${encodeURIComponent(timeframe)}`, { headers: { ...authHeaders() } });
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
      body: JSON.stringify({ bet: Number(bet) })
    });
    return await safeJson(res);
  }catch(e){
    return { error: e.message || "network_error" };
  }
}
