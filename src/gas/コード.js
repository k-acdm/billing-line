/**
 * billing-line：月次引き落とし配信システム
 */

// ============================================
// 設定取得
// ============================================
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID'),
    lineChannelAccessToken: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN'),
    adminLineUserIds: props.getProperty('ADMIN_LINE_USER_IDS')
  };
}

function getSpreadsheet() {
  const config = getConfig();
  return SpreadsheetApp.openById(config.spreadsheetId);
}

// ============================================
// Webアプリのエントリポイント
// ============================================
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var page = (e && e.parameter && e.parameter.page) || '';
  
  // LINE Login関連のアクション
  if (action === 'lineLoginStart')    return _handleLineLoginStart(e.parameter);
  if (action === 'lineLoginCallback') return _handleLineLoginCallback(e.parameter);
  if (action === 'lineLoginRegister') return _handleLineLoginRegister(e.parameter);
  
  // 未紐付けメッセージ管理画面
  if (page === 'unlinked') {
    return HtmlService.createHtmlOutputFromFile('unlinked')
      .setTitle('未紐付けメッセージ管理 - billing-line')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  
  // それ以外は管理画面
  return HtmlService.createHtmlOutputFromFile('admin')
    .setTitle('billing-line 管理画面')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================
// API：未登録家族一覧取得
// ============================================
function getUnregisteredFamilies() {
  const ss = getSpreadsheet();
  const familiesSheet = ss.getSheetByName('Families');
  const studentsSheet = ss.getSheetByName('Students');
  
  // Familiesシート読込
  const familiesData = familiesSheet.getDataRange().getValues();
  const familiesHeader = familiesData[0];
  const familiesRows = familiesData.slice(1);
  
  // Studentsシート読込
  const studentsData = studentsSheet.getDataRange().getValues();
  const studentsRows = studentsData.slice(1);
  
  // 列インデックス取得
  const fIdx = {
    familyId: familiesHeader.indexOf('家族ID'),
    name: familiesHeader.indexOf('宛名'),
    type: familiesHeader.indexOf('配信区分'),
    lineUserId: familiesHeader.indexOf('保護者LINE_USER_ID'),
    active: familiesHeader.indexOf('配信有効フラグ')
  };
  
  // 未登録家族を抽出（LINE_USER_ID が空 かつ 配信有効フラグTRUE）
  const unregistered = familiesRows
    .filter(row => row[fIdx.familyId] && !row[fIdx.lineUserId] && row[fIdx.active] === true)
    .map(row => {
      const familyId = row[fIdx.familyId];
      // この家族の生徒を集める
      const students = studentsRows
        .filter(s => s[1] === familyId && s[5] === true)  // 家族ID一致 かつ 在籍中
        .map(s => ({
          grade: s[2],     // 学年
          name: s[3],      // 生徒氏名
          order: s[4]      // 兄弟順位
        }))
        .sort((a, b) => a.order - b.order);
      
      return {
        familyId: familyId,
        name: row[fIdx.name],
        type: row[fIdx.type],
        students: students
      };
    });
  
  return unregistered;
}

// ============================================
// 動作確認用
// ============================================
function testConnection() {
  const config = getConfig();
  
  if (!config.spreadsheetId) {
    Logger.log('❌ SPREADSHEET_IDが設定されていません');
    return;
  }
  
  try {
    const ss = SpreadsheetApp.openById(config.spreadsheetId);
    Logger.log('✅ スプレッドシート接続成功：' + ss.getName());
    
    const expectedSheets = ['Families', 'Students', 'Billings', 'BillingItems', 'FollowUps', 'Config'];
    const actualSheets = ss.getSheets().map(s => s.getName());
    
    const missing = expectedSheets.filter(name => !actualSheets.includes(name));
    if (missing.length === 0) {
      Logger.log('✅ 6シートすべて存在を確認');
    } else {
      Logger.log('❌ 不足シート：' + missing.join(', '));
    }
  } catch (e) {
    Logger.log('❌ エラー：' + e.toString());
  }
}

function testGetUnregistered() {
  const result = getUnregisteredFamilies();
  Logger.log('未登録家族数：' + result.length);
  result.forEach(f => {
    Logger.log(`[${f.familyId}] ${f.name}（${f.type}）`);
    f.students.forEach(s => Logger.log(`  - ${s.grade} ${s.name}`));
  });
}

// ============================================
// トークン生成・URL発行（方式A）
// ============================================

/**
 * 8文字英数字のランダムトークンを生成
 */
function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  // 紛らわしい文字（I/l/1/0/O）を除外
  let token = '';
  for (let i = 0; i < 8; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * 家族IDに対してトークンを発行する
 * 既存の有効トークンがある場合は無効化し、新トークンを発行
 * @param {string} familyId - 家族ID（例: F001）
 * @return {Object} {token, url, familyId, familyName}
 */
function issueTokenForFamily(familyId) {
  const ss = getSpreadsheet();
  const tokensSheet = ss.getSheetByName('Tokens');
  const familiesSheet = ss.getSheetByName('Families');
  
  // 家族存在確認
  const familiesData = familiesSheet.getDataRange().getValues();
  const familiesHeader = familiesData[0];
  const fIdx = {
    familyId: familiesHeader.indexOf('家族ID'),
    name: familiesHeader.indexOf('宛名'),
    lineUserId: familiesHeader.indexOf('保護者LINE_USER_ID')
  };
  
  const family = familiesData.slice(1).find(row => row[fIdx.familyId] === familyId);
  if (!family) {
    throw new Error('家族ID ' + familyId + ' が見つかりません');
  }
  
  // 既に登録済みの場合はエラー
  if (family[fIdx.lineUserId]) {
    throw new Error(family[fIdx.name] + ' は既に登録済みです');
  }
  
  // 既存の有効トークンを無効化
  const tokensData = tokensSheet.getDataRange().getValues();
  const tokensHeader = tokensData[0];
  const tIdx = {
    token: tokensHeader.indexOf('トークン'),
    familyId: tokensHeader.indexOf('家族ID'),
    issuedAt: tokensHeader.indexOf('発行日時'),
    status: tokensHeader.indexOf('状態'),
    usedAt: tokensHeader.indexOf('使用日時')
  };
  
  for (let i = 1; i < tokensData.length; i++) {
    if (tokensData[i][tIdx.familyId] === familyId && tokensData[i][tIdx.status] === '有効') {
      tokensSheet.getRange(i + 1, tIdx.status + 1).setValue('無効化');
    }
  }
  
  // 新トークン生成（重複チェック）
  let newToken;
  let attempts = 0;
  do {
    newToken = generateToken();
    attempts++;
    if (attempts > 10) {
      throw new Error('トークン生成リトライ上限');
    }
  } while (tokensData.some(row => row[tIdx.token] === newToken));
  
  // Tokensシートに追加
  tokensSheet.appendRow([
    newToken,
    familyId,
    new Date(),
    '有効',
    ''
  ]);
  
  // URL生成（後で実際のGitHub Pages URLに差し替え）
  // 暫定：プレースホルダURL
  const baseUrl = 'https://k-acdm.github.io/billing-line/register.html';
  const url = baseUrl + '?t=' + newToken;
  
  return {
    token: newToken,
    url: url,
    familyId: familyId,
    familyName: family[fIdx.name]
  };
}

/**
 * テスト：F001 にトークン発行
 */
function testIssueToken() {
  try {
    const result = issueTokenForFamily('F001');
    Logger.log('✅ トークン発行成功');
    Logger.log('家族：' + result.familyName + ' (' + result.familyId + ')');
    Logger.log('トークン：' + result.token);
    Logger.log('URL：' + result.url);
  } catch (e) {
    Logger.log('❌ エラー：' + e.toString());
  }
}

// ============================================
// LINE Login OAuth（方式A）
// ============================================
// マイ活アプリの実装を移植・billing-line用に書き換え
// 元コード：mykt-eitango/gas/Code.js L19000-19560

// 定数
const LINE_LOGIN_TEMP_TTL_SEC  = 300;  // 一時トークンの有効期間（秒）
const LINE_LOGIN_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_LOGIN_TOKEN_URL     = 'https://api.line.me/oauth2/v2.1/token';
const LINE_LOGIN_PROFILE_URL   = 'https://api.line.me/v2/profile';

// --- スクリプトプロパティ取得 ---
function _getLineLoginChannelId()       { try { return String(PropertiesService.getScriptProperties().getProperty('LINE_LOGIN_CHANNEL_ID') || '').trim(); } catch(e){ return ''; } }
function _getLineLoginChannelSecret()   { try { return String(PropertiesService.getScriptProperties().getProperty('LINE_LOGIN_CHANNEL_SECRET') || '').trim(); } catch(e){ return ''; } }
function _getLineMessagingAccessToken() { try { return String(PropertiesService.getScriptProperties().getProperty('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN') || '').trim(); } catch(e){ return ''; } }

// --- WEB_APP_URL ヘルパー（マイ活L19048の「access.line.me接続拒否」対策を継承） ---
function _getWebAppUrl() {
  var url = '';
  try {
    url = String(PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || '').trim();
  } catch (e) {}
  if (!url) {
    throw new Error('WEB_APP_URL が ScriptProperties に未設定です。Apps Script のプロジェクト設定 → スクリプトプロパティで登録してください（値は LINE Console に登録した Callback URL から ?action=lineLoginCallback を除いた本体のみ）。');
  }
  return url;
}
function _getWebAppUrlOrEmpty() {
  try { return _getWebAppUrl(); } catch (e) { return ''; }
}
function _getCallbackUrl() {
  return _getWebAppUrl() + '?action=lineLoginCallback';
}

// --- 一時トークン管理（CacheService） ---
function _saveTempLineToken(userId, familyId, displayName) {
  try {
    var cache = CacheService.getScriptCache();
    var tempToken = Utilities.getUuid();
    var payload = JSON.stringify({ userId: userId, familyId: familyId, displayName: displayName || '' });
    cache.put('line_login_' + tempToken, payload, LINE_LOGIN_TEMP_TTL_SEC);
    return tempToken;
  } catch (e) {
    console.error('[_saveTempLineToken]', e);
    return null;
  }
}
function _getTempLineToken(tempToken) {
  if (!tempToken) return null;
  try {
    var cache = CacheService.getScriptCache();
    var data = cache.get('line_login_' + String(tempToken).trim());
    if (!data) return null;
    return JSON.parse(data);
  } catch (e) {
    console.error('[_getTempLineToken]', e);
    return null;
  }
}
function _deleteTempLineToken(tempToken) {
  try { CacheService.getScriptCache().remove('line_login_' + String(tempToken).trim()); } catch(e){}
}

// --- 家族特定（トークンから） ---
function _findFamilyByToken(token) {
  if (!token) return null;
  var ss = getSpreadsheet();
  var tokensSheet = ss.getSheetByName('Tokens');
  var familiesSheet = ss.getSheetByName('Families');
  var studentsSheet = ss.getSheetByName('Students');

  var tokensData = tokensSheet.getDataRange().getValues();
  var tHeader = tokensData[0];
  var tIdx = {
    token: tHeader.indexOf('トークン'),
    familyId: tHeader.indexOf('家族ID'),
    status: tHeader.indexOf('状態')
  };

  // トークン検索
  var tokenRow = null;
  var tokenRowIdx = -1;
  for (var i = 1; i < tokensData.length; i++) {
    if (tokensData[i][tIdx.token] === token) {
      tokenRow = tokensData[i];
      tokenRowIdx = i;
      break;
    }
  }
  if (!tokenRow) return null;
  if (tokenRow[tIdx.status] !== '有効') return { invalid: true, status: tokenRow[tIdx.status] };

  var familyId = tokenRow[tIdx.familyId];

  // 家族情報取得
  var familiesData = familiesSheet.getDataRange().getValues();
  var fHeader = familiesData[0];
  var fIdx = {
    familyId: fHeader.indexOf('家族ID'),
    name: fHeader.indexOf('宛名'),
    type: fHeader.indexOf('配信区分'),
    lineUserId: fHeader.indexOf('保護者LINE_USER_ID')
  };
  var family = familiesData.slice(1).find(function(row) { return row[fIdx.familyId] === familyId; });
  if (!family) return null;

  // 既に登録済みの場合
  if (family[fIdx.lineUserId]) {
    return { alreadyRegistered: true, familyName: family[fIdx.name] };
  }

  // 生徒情報取得
  var studentsData = studentsSheet.getDataRange().getValues();
  var students = studentsData.slice(1)
    .filter(function(s) { return s[1] === familyId && s[5] === true; })
    .map(function(s) { return { grade: s[2], name: s[3], order: s[4] }; })
    .sort(function(a, b) { return a.order - b.order; });

  return {
    familyId: familyId,
    familyName: family[fIdx.name],
    type: family[fIdx.type],
    students: students,
    tokenRowIdx: tokenRowIdx
  };
}

// --- HTMLレンダリング ---
function _escapeHtmlMinimal(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _renderLineLayoutHtml(title, bodyHtml) {
  var css =
    '* { box-sizing: border-box; }' +
    'body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #fff7ed, #fef3c7); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px 16px; color: #333; }' +
    '.line-card { background: #fff; border-radius: 18px; padding: 26px 22px; max-width: 440px; width: 100%; box-shadow: 0 12px 32px rgba(0,0,0,.12); text-align: center; }' +
    '.line-card h1 { color: #06c755; font-size: 22px; margin: 0 0 12px; }' +
    '.line-card p { margin: 10px 0; line-height: 1.8; font-size: 14px; color: #555; }' +
    '.line-card strong { color: #b45309; }' +
    '.line-card .line-msg { margin: 16px 0; padding: 12px 14px; border-radius: 10px; font-size: 14px; line-height: 1.7; }' +
    '.line-card .line-msg.error   { background: #fee2e2; border: 1.5px solid #f87171; color: #b91c1c; }' +
    '.line-card .line-msg.success { background: #d1fae5; border: 1.5px solid #34d399; color: #065f46; }' +
    '.line-card .line-msg.info    { background: #f8f9fa; border: 1.5px solid #d1d5db; color: #4b5563; text-align: left; }' +
    '.line-card .btn-line { display: block; width: 100%; margin-top: 16px; padding: 14px; background: linear-gradient(135deg, #06c755, #04a64b); color: #fff; border: 0; border-radius: 12px; font-size: 16px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(6,199,85,.3); text-decoration: none; }' +
    '.line-card .small-note { font-size: 12px; color: #888; margin-top: 14px; }' +
'.line-card .student-list { font-size: 14px; color: #4b5563; margin: 4px 0; }' +
    '.line-card .btn-line-hero { margin-top: 22px; padding: 20px; font-size: 19px; letter-spacing: .5px; box-shadow: 0 6px 18px rgba(6,199,85,.4); }' +
    '.line-card .line-step-title { font-size: 24px; margin: 0 0 18px; }' +
    '.line-card .line-step-lead { font-size: 16px; line-height: 1.9; margin: 14px 0 6px; color: #444; }';
  var html =
    '<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + _escapeHtmlMinimal(title) + '</title>' +
    '<style>' + css + '</style></head><body>' +
    '<div class="line-card">' + bodyHtml + '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle(title).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function _renderLineErrorHtml(title, msg) {
  var body =
    '<h1>⚠️ ' + _escapeHtmlMinimal(title) + '</h1>' +
    '<div class="line-msg error">' + msg + '</div>' +
    '<p class="small-note">お困りの場合は塾の福地までご連絡ください。</p>';
  return _renderLineLayoutHtml(title, body);
}

function _renderLineSuccessHtml(familyName, displayName) {
  var body =
    '<h1>✅ 登録完了！</h1>' +
    '<p class="small-note">このページを閉じて、LINE に戻ってください。</p>';
  return _renderLineLayoutHtml('登録完了', body);
}

// --- Handler: lineLoginStart（保護者がregister.htmlで「LINEで登録」を押した時） ---
function _handleLineLoginStart(params) {
  var token = String((params && params.token) || '').trim();
  if (!token) {
    return _renderLineErrorHtml('登録URLが不正です', 'トークンが指定されていません。登録URLが正しいかご確認ください。');
  }

  // トークンの有効性確認
  var family = _findFamilyByToken(token);
  if (!family) {
    return _renderLineErrorHtml('登録URLが無効です', 'このURLは無効か、既に新しいURLが発行されています。最新のURLをご確認ください。');
  }
  if (family.invalid) {
    return _renderLineErrorHtml('登録URLが無効です', 'このURLは「' + _escapeHtmlMinimal(family.status) + '」状態のため、ご利用いただけません。');
  }
  if (family.alreadyRegistered) {
    return _renderLineErrorHtml('既に登録済みです', '<strong>' + _escapeHtmlMinimal(family.familyName) + '</strong> は既にLINE登録が完了しています。');
  }

  var channelId = _getLineLoginChannelId();
  if (!channelId) {
    return _renderLineErrorHtml('準備中', 'LINE Login の設定がまだ完了していません。塾の福地までお問い合わせください。');
  }

  var callbackUrl;
  try { callbackUrl = _getCallbackUrl(); }
  catch (e) { return _renderLineErrorHtml('設定エラー', String(e && e.message || e)); }

  // state にトークンを埋め込む（CSRF対策のnonceも含める）
  var nonce = Utilities.getUuid().substring(0, 8);
  var state = token + ':' + nonce;
  var authorizeUrl = LINE_LOGIN_AUTHORIZE_URL
    + '?response_type=code'
    + '&client_id=' + encodeURIComponent(channelId)
    + '&redirect_uri=' + encodeURIComponent(callbackUrl)
    + '&state=' + encodeURIComponent(state)
    + '&scope=' + encodeURIComponent('profile openid');

var body =
    '<h1 class="line-step-title">📲 LINE 連携の最終ステップ</h1>' +
    '<p class="line-step-lead">下のボタンをタップして、<br>LINE の認可画面に進んでください。</p>' +
    '<a class="btn-line btn-line-hero" id="line-jump" target="_top" href="' + _escapeHtmlMinimal(authorizeUrl) + '">LINE を開く</a>';
  return _renderLineLayoutHtml('LINE 連携の最終ステップ', body);
}

// --- Handler: lineLoginCallback（LINEから code を受け取る） ---
function _handleLineLoginCallback(params) {
  var code = String((params && params.code) || '').trim();
  var state = String((params && params.state) || '').trim();
  var token = state.split(':')[0];

  if (!token) {
    return _renderLineErrorHtml('不正なリクエスト', 'state パラメータが不正です。最初から登録URLをタップしてください。');
  }
  if (!code) {
    return _renderLineErrorHtml('認可がキャンセルされました', 'LINE 側で「キャンセル」が押されたか、コードが取得できませんでした。');
  }

  // トークン再確認（途中で無効化されていないか）
  var family = _findFamilyByToken(token);
  if (!family || family.invalid || family.alreadyRegistered) {
    return _renderLineErrorHtml('登録URLが無効になっています', '認証中にトークンの状態が変わったようです。最新のURLでもう一度お試しください。');
  }

  var channelId = _getLineLoginChannelId();
  var channelSecret = _getLineLoginChannelSecret();
  if (!channelId || !channelSecret) {
    return _renderLineErrorHtml('準備中', 'LINE Login の設定がまだ完了していません。塾の福地までお問い合わせください。');
  }

  var callbackUrl;
  try { callbackUrl = _getCallbackUrl(); }
  catch (e) { return _renderLineErrorHtml('設定エラー', String(e && e.message || e)); }

  // code → access_token
  var tokenRes;
  try {
    tokenRes = UrlFetchApp.fetch(LINE_LOGIN_TOKEN_URL, {
      method: 'post',
      contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: callbackUrl,
        client_id: channelId,
        client_secret: channelSecret
      },
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('[lineLoginCallback] token fetch failed', e);
    return _renderLineErrorHtml('LINE 接続エラー', 'LINE への接続に失敗しました。時間を空けてもう一度お試しください。');
  }
  var tokenStatus = tokenRes.getResponseCode();
  var tokenJson = {};
  try { tokenJson = JSON.parse(tokenRes.getContentText()); } catch(e){}
  if (tokenStatus !== 200 || !tokenJson.access_token) {
    console.error('[lineLoginCallback] token error', tokenStatus, tokenRes.getContentText());
    return _renderLineErrorHtml('LINE 認証エラー', '認証コードの交換に失敗しました。最初からやり直してください。');
  }
  var accessToken = String(tokenJson.access_token || '').trim();

  // access_token → profile
  var profileRes;
  try {
    profileRes = UrlFetchApp.fetch(LINE_LOGIN_PROFILE_URL, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + accessToken },
      muteHttpExceptions: true
    });
  } catch (e) {
    console.error('[lineLoginCallback] profile fetch failed', e);
    return _renderLineErrorHtml('LINE 接続エラー', 'プロフィール取得に失敗しました。');
  }
  if (profileRes.getResponseCode() !== 200) {
    return _renderLineErrorHtml('LINE プロフィール取得エラー', 'LINE のプロフィール情報を取得できませんでした。');
  }
  var profile = {};
  try { profile = JSON.parse(profileRes.getContentText()); } catch(e){}
  var userId = String(profile.userId || '').trim();
  if (!userId) {
    return _renderLineErrorHtml('LINE userId 取得失敗', 'LINE の userId が取得できませんでした。最初からやり直してください。');
  }

  // CacheServiceに保存
  var tempToken = _saveTempLineToken(userId, family.familyId, profile.displayName || '');
  if (!tempToken) {
    return _renderLineErrorHtml('内部エラー', '一時データの保存に失敗しました。最初からやり直してください。');
  }

  // 確認画面を表示
  return _renderLineConfirmHtml(tempToken, family, profile.displayName || '');
}

// --- 登録確認画面 ---
function _renderLineConfirmHtml(tempToken, family, displayName) {
  var formAction;
  try { formAction = _getWebAppUrl(); }
  catch (e) { return _renderLineErrorHtml('設定エラー', String(e && e.message || e)); }

  var greet = displayName
    ? '<strong>' + _escapeHtmlMinimal(displayName) + '</strong> さん、こんにちは！<br>'
    : '';

  var studentsHtml = family.students.map(function(s) {
    return '<p class="student-list">・' + _escapeHtmlMinimal(s.grade) + ' ' + _escapeHtmlMinimal(s.name) + '</p>';
  }).join('');

  var body =
    '<h1>📲 LINE 連携の確認</h1>' +
    '<p>' + greet + '以下のご登録で間違いないか、ご確認ください。</p>' +
    '<div class="line-msg info">' +
      '<p style="margin: 0 0 8px; font-weight: bold; color: #1f2937;">' + _escapeHtmlMinimal(family.familyName) + '</p>' +
      studentsHtml +
    '</div>' +
    '<form id="register-form" method="get" target="_top" action="' + _escapeHtmlMinimal(formAction) + '" onsubmit="return handleSubmit(this);">' +
    '<input type="hidden" name="action" value="lineLoginRegister"/>' +
    '<input type="hidden" name="tempToken" value="' + _escapeHtmlMinimal(tempToken) + '"/>' +
    '<button id="register-btn" class="btn-line" type="submit">この内容で登録する</button>' +
    '</form>' +
    '<p class="small-note">※ 5 分以内に「登録する」ボタンを押してください。期限切れの場合は最初の登録URLからやり直してください。</p>' +
    '<style>' +
      '.btn-line.processing { background: #9ca3af !important; cursor: wait !important; pointer-events: none; }' +
      '.btn-line.processing::before { content: "⏳ "; }' +
    '</style>' +
    '<script>' +
      'function handleSubmit(form) {' +
        'var btn = document.getElementById("register-btn");' +
        'if (btn.disabled) return false;' +
        'btn.disabled = true;' +
        'btn.classList.add("processing");' +
        'btn.innerText = "登録中... しばらくお待ちください";' +
        'return true;' +
      '}' +
    '<' + '/script>';
  return _renderLineLayoutHtml('登録確認', body);
}

// --- Handler: lineLoginRegister（確認画面の登録ボタン） ---
function _handleLineLoginRegister(params) {
  var tempToken = String((params && params.tempToken) || '').trim();
  if (!tempToken) {
    return _renderLineErrorHtml('セッションエラー', '一時トークンが指定されていません。最初からやり直してください。');
  }

  var temp = _getTempLineToken(tempToken);
  if (!temp) {
    return _renderLineErrorHtml('セッションが切れました', 'LINE 認証から 5 分以上経過しました。最初の登録URLからやり直してください。');
  }

  var userId = String(temp.userId || '').trim();
  var familyId = String(temp.familyId || '').trim();
  var displayName = String(temp.displayName || '').trim();

  if (!userId || !familyId) {
    _deleteTempLineToken(tempToken);
    return _renderLineErrorHtml('内部エラー', 'セッション情報が壊れています。最初からやり直してください。');
  }

  // Familiesシート書き込み
  var ss = getSpreadsheet();
  var familiesSheet = ss.getSheetByName('Families');
  var familiesData = familiesSheet.getDataRange().getValues();
  var fHeader = familiesData[0];
  var fIdx = {
    familyId: fHeader.indexOf('家族ID'),
    name: fHeader.indexOf('宛名'),
    lineUserId: fHeader.indexOf('保護者LINE_USER_ID'),
    registeredAt: fHeader.indexOf('登録日')
  };

  var rowIdx = -1;
  var familyName = '';
  for (var i = 1; i < familiesData.length; i++) {
    if (familiesData[i][fIdx.familyId] === familyId) {
      rowIdx = i;
      familyName = familiesData[i][fIdx.name];
      // 二重登録チェック
      if (familiesData[i][fIdx.lineUserId]) {
        _deleteTempLineToken(tempToken);
        return _renderLineErrorHtml('既に登録済みです', '<strong>' + _escapeHtmlMinimal(familyName) + '</strong> は既にLINE登録が完了しています。');
      }
      break;
    }
  }

  if (rowIdx < 0) {
    _deleteTempLineToken(tempToken);
    return _renderLineErrorHtml('家族情報が見つかりません', '家族ID ' + familyId + ' が見つかりませんでした。');
  }

  // LINE_USER_ID 書き込み
  try {
    var cell = familiesSheet.getRange(rowIdx + 1, fIdx.lineUserId + 1);
    cell.setNumberFormat('@');
    cell.setValue(userId);
    if (fIdx.registeredAt >= 0) {
      familiesSheet.getRange(rowIdx + 1, fIdx.registeredAt + 1).setValue(new Date());
    }
  } catch (e) {
    console.error('[_handleLineLoginRegister] setValue failed', e);
    return _renderLineErrorHtml('書き込みエラー', 'スプレッドシートへの書き込みに失敗しました。時間を空けてもう一度お試しください。');
  }

  // Tokensシート：このトークンを「使用済」に
  try {
    var tokensSheet = ss.getSheetByName('Tokens');
    var tokensData = tokensSheet.getDataRange().getValues();
    var tHeader = tokensData[0];
    var tIdx = {
      familyId: tHeader.indexOf('家族ID'),
      status: tHeader.indexOf('状態'),
      usedAt: tHeader.indexOf('使用日時')
    };
    for (var j = 1; j < tokensData.length; j++) {
      if (tokensData[j][tIdx.familyId] === familyId && tokensData[j][tIdx.status] === '有効') {
        tokensSheet.getRange(j + 1, tIdx.status + 1).setValue('使用済');
        tokensSheet.getRange(j + 1, tIdx.usedAt + 1).setValue(new Date());
      }
    }
  } catch (e) {
    console.error('[_handleLineLoginRegister] tokens update failed', e);
  }

  _deleteTempLineToken(tempToken);
  return _renderLineSuccessHtml(familyName, displayName);
}

/**
 * 権限承認発動用：UrlFetchAppを実際に呼び出して権限ダイアログを出す
 */
function _testTriggerPermission() {
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/profile', {
      method: 'get',
      headers: { Authorization: 'Bearer dummy_token' },
      muteHttpExceptions: true
    });
    Logger.log('Response code: ' + res.getResponseCode());
    Logger.log('成功（権限OK）');
  } catch (e) {
    Logger.log('エラー：' + e.toString());
  }
}

// ============================================
// 登録済み家族の管理
// ============================================

/**
 * 登録済み家族一覧を取得
 * @return {Array} 登録済み家族の配列
 */
function getRegisteredFamilies() {
  var ss = getSpreadsheet();
  var familiesSheet = ss.getSheetByName('Families');
  var studentsSheet = ss.getSheetByName('Students');
  
  var familiesData = familiesSheet.getDataRange().getValues();
  var familiesHeader = familiesData[0];
  var familiesRows = familiesData.slice(1);
  
  var studentsData = studentsSheet.getDataRange().getValues();
  var studentsRows = studentsData.slice(1);
  
  var fIdx = {
    familyId: familiesHeader.indexOf('家族ID'),
    name: familiesHeader.indexOf('宛名'),
    type: familiesHeader.indexOf('配信区分'),
    lineUserId: familiesHeader.indexOf('保護者LINE_USER_ID'),
    registeredAt: familiesHeader.indexOf('登録日'),
    active: familiesHeader.indexOf('配信有効フラグ')
  };
  
  // 登録済み家族を抽出（LINE_USER_ID が空でない かつ 配信有効フラグTRUE）
  var registered = familiesRows
    .filter(function(row) {
      return row[fIdx.familyId] && row[fIdx.lineUserId] && row[fIdx.active] === true;
    })
    .map(function(row) {
      var familyId = row[fIdx.familyId];
      var students = studentsRows
        .filter(function(s) { return s[1] === familyId && s[5] === true; })
        .map(function(s) { return { grade: s[2], name: s[3], order: s[4] }; })
        .sort(function(a, b) { return a.order - b.order; });
      
      var lineUserId = String(row[fIdx.lineUserId] || '');
      var registeredAt = row[fIdx.registeredAt];
      var registeredAtStr = '';
      if (registeredAt instanceof Date) {
        registeredAtStr = Utilities.formatDate(registeredAt, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else if (registeredAt) {
        registeredAtStr = String(registeredAt);
      }
      
      return {
        familyId: familyId,
        name: row[fIdx.name],
        type: row[fIdx.type],
        students: students,
        lineUserIdShort: lineUserId.substring(0, 8) + '...',
        registeredAt: registeredAtStr
      };
    });
  
  return registered;
}

/**
 * 家族の登録を解除する（LINE_USER_IDを空に）
 * @param {string} familyId - 家族ID
 * @return {Object} 結果
 */
function unregisterFamily(familyId) {
  if (!familyId) {
    throw new Error('家族IDが指定されていません');
  }
  
  var ss = getSpreadsheet();
  var familiesSheet = ss.getSheetByName('Families');
  var familiesData = familiesSheet.getDataRange().getValues();
  var familiesHeader = familiesData[0];
  
  var fIdx = {
    familyId: familiesHeader.indexOf('家族ID'),
    name: familiesHeader.indexOf('宛名'),
    lineUserId: familiesHeader.indexOf('保護者LINE_USER_ID'),
    registeredAt: familiesHeader.indexOf('登録日')
  };
  
  for (var i = 1; i < familiesData.length; i++) {
    if (familiesData[i][fIdx.familyId] === familyId) {
      var familyName = familiesData[i][fIdx.name];
      
      if (!familiesData[i][fIdx.lineUserId]) {
        throw new Error(familyName + ' は登録されていません');
      }
      
      // LINE_USER_IDを空にする
      familiesSheet.getRange(i + 1, fIdx.lineUserId + 1).setValue('');
      // 登録日も空にする
      if (fIdx.registeredAt >= 0) {
        familiesSheet.getRange(i + 1, fIdx.registeredAt + 1).setValue('');
      }
      
      return {
        success: true,
        familyId: familyId,
        familyName: familyName
      };
    }
  }
  
  throw new Error('家族ID ' + familyId + ' が見つかりません');
}

/**
 * テスト：登録済み家族取得
 */
function testGetRegistered() {
  var result = getRegisteredFamilies();
  Logger.log('登録済み家族数：' + result.length);
  result.forEach(function(f) {
    Logger.log('[' + f.familyId + '] ' + f.name + ' (LINE: ' + f.lineUserIdShort + ', 登録日: ' + f.registeredAt + ')');
  });
}

// ============================================
// Webhook受信（方式B：公式LINEメッセージ受信）
// ============================================

/**
 * doPostエンドポイント：マイ活GASからの転送 or 直接Webhook受信を処理
 */
function doPost(e) {
  try {
    if (_isLineWebhookRequestBL(e)) {
      return _handleLineWebhookBL(e);
    }
  } catch (err) {
    console.error('[doPost]', err);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * LINE Webhookリクエスト判定（billing-line用）
 */
function _isLineWebhookRequestBL(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return false;
    var ct = String(e.postData.type || '').toLowerCase();
    if (ct.indexOf('json') < 0) return false;
    var body = String(e.postData.contents || '');
    if (body.indexOf('"events"') < 0) return false;
    return true;
  } catch (_) { return false; }
}

/**
 * Webhook処理本体
 * follow（友だち追加）/ message（メッセージ受信）イベントを処理
 */
function _handleLineWebhookBL(e) {
  try {
    console.log('[BL受信] payload全体: ' + (e.postData ? e.postData.contents : 'なし').substring(0, 500));

    var parsed = JSON.parse(e.postData.contents);
    var events = (parsed && Array.isArray(parsed.events)) ? parsed.events : [];
    
    console.log('[billing-line webhook] events=' + events.length);
    
    events.forEach(function(event) {
      try {
        if (event.type === 'follow') {
          _recordFollowEvent(event);
        } else if (event.type === 'message') {
          _recordMessageEvent(event);
        }
        // unfollow等は無視
      } catch (innerErr) {
        console.error('[event処理エラー]', innerErr, JSON.stringify(event));
      }
    });
  } catch (err) {
    console.error('[_handleLineWebhookBL]', err);
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * 友だち追加イベントを記録
 */
function _recordFollowEvent(event) {
  var userId = event.source && event.source.userId;
  if (!userId) return;
  
  // 既に登録済みなら記録不要
  if (_isAlreadyRegisteredLineUserId(userId)) {
    console.log('[follow] 既に登録済のユーザー：' + userId.substring(0, 8) + '...');
    return;
  }
  
  // 既にIncomingMessagesに「未紐付け」で居るなら、重複記録を避ける
  if (_hasUnlinkedRecord(userId)) {
    console.log('[follow] 既に未紐付け記録あり：' + userId.substring(0, 8) + '...');
    return;
  }
  
  var profile = _getLineProfile(userId);
  _appendIncomingMessage({
    userId: userId,
    displayName: profile.displayName || '',
    pictureUrl: profile.pictureUrl || '',
    statusMessage: profile.statusMessage || '',
    messageType: 'follow',
    messageBody: '友だち追加'
  });
}

/**
 * メッセージ受信イベントを記録
 */
function _recordMessageEvent(event) {
  var userId = event.source && event.source.userId;
  if (!userId) return;
  
  // 既に登録済みなら記録不要
  if (_isAlreadyRegisteredLineUserId(userId)) {
    console.log('[message] 既に登録済のユーザー：' + userId.substring(0, 8) + '...');
    return;
  }
  
  // メッセージ種別と本文を判定
  var message = event.message || {};
  var msgType = message.type || 'unknown';
  var msgBody = '';
  if (msgType === 'text') {
    msgBody = String(message.text || '');
  } else {
    msgBody = msgType; // sticker / image / video 等はそのまま種別を本文として記録
  }
  
  var profile = _getLineProfile(userId);
  _appendIncomingMessage({
    userId: userId,
    displayName: profile.displayName || '',
    pictureUrl: profile.pictureUrl || '',
    statusMessage: profile.statusMessage || '',
    messageType: msgType,
    messageBody: msgBody
  });
}

/**
 * LINEプロフィール取得
 */
function _getLineProfile(userId) {
  var token = _getLineMessagingAccessToken();
  if (!token) {
    console.error('[_getLineProfile] LINE_MESSAGING_CHANNEL_ACCESS_TOKEN 未設定');
    return {};
  }
  try {
    var url = 'https://api.line.me/v2/bot/profile/' + encodeURIComponent(userId);
    var res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      console.error('[_getLineProfile] status=' + res.getResponseCode());
      return {};
    }
    return JSON.parse(res.getContentText()) || {};
  } catch (err) {
    console.error('[_getLineProfile]', err);
    return {};
  }
}

/**
 * 既にFamiliesシートに登録済みのLINE_USER_IDかチェック
 */
function _isAlreadyRegisteredLineUserId(userId) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('Families');
    var data = sheet.getDataRange().getValues();
    var header = data[0];
    var idx = header.indexOf('保護者LINE_USER_ID');
    if (idx < 0) return false;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx]).trim() === userId) return true;
    }
    return false;
  } catch (err) {
    console.error('[_isAlreadyRegisteredLineUserId]', err);
    return false;
  }
}

/**
 * IncomingMessagesシートに「未紐付け」状態の同一USER_IDが存在するかチェック
 */
function _hasUnlinkedRecord(userId) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('IncomingMessages');
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return false;
    var header = data[0];
    var uidIdx = header.indexOf('LINE_USER_ID');
    var statusIdx = header.indexOf('紐付けステータス');
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][uidIdx]).trim() === userId && data[i][statusIdx] === '未紐付け') {
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error('[_hasUnlinkedRecord]', err);
    return false;
  }
}

/**
 * IncomingMessagesシートに新規行を追記
 */
function _appendIncomingMessage(rec) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName('IncomingMessages');
  if (!sheet) throw new Error('IncomingMessagesシートが見つかりません');
  
  sheet.appendRow([
    new Date(),                                        // 受信日時
    rec.userId,                                        // LINE_USER_ID
    rec.displayName || '',                             // 表示名
    rec.pictureUrl || '',                              // プロフィール画像URL
    rec.statusMessage || '',                           // ステータスメッセージ
    rec.messageType || '',                             // メッセージ種別
    rec.messageBody || '',                             // メッセージ本文
    '未紐付け',                                          // 紐付けステータス
    '',                                                // 紐付け家族ID
    ''                                                 // 紐付け日時
  ]);
  
  // LINE_USER_IDを文字列として確実に保持
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 2).setNumberFormat('@');
}

/**
 * テスト：模擬Webhookイベントを生成して動作確認
 */
function _testWebhookFollow() {
  var mockEvent = {
    postData: {
      type: 'application/json',
      contents: JSON.stringify({
        events: [{
          type: 'follow',
          source: { userId: 'Utest_dummy_user_id_for_test' }
        }]
      })
    }
  };
  var result = doPost(mockEvent);
  Logger.log('テスト結果: ' + result.getContent());
  Logger.log('IncomingMessagesシートを確認してください');
}

// ============================================
// 未紐付けメッセージの管理（Phase 2B Step 6）
// ============================================

/**
 * 未紐付けメッセージ一覧を取得
 */
function getUnlinkedMessages() {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName('IncomingMessages');
    if (!sheet) return [];
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    
    var header = sheet.getRange(1, 1, 1, 10).getValues()[0];
    var idx = {
      receivedAt: header.indexOf('受信日時'),
      lineUserId: header.indexOf('LINE_USER_ID'),
      displayName: header.indexOf('表示名'),
      pictureUrl: header.indexOf('プロフィール画像URL'),
      statusMessage: header.indexOf('ステータスメッセージ'),
      messageType: header.indexOf('メッセージ種別'),
      messageBody: header.indexOf('メッセージ本文'),
      status: header.indexOf('紐付けステータス')
    };
    
    // 最新300件のみスキャン、結果は最大30件
    var startRow = Math.max(2, lastRow - 299);
    var rowCount = lastRow - startRow + 1;
    var data = sheet.getRange(startRow, 1, rowCount, 10).getValues();
    
    var result = [];
    var maxResults = 30;
    
    for (var i = data.length - 1; i >= 0 && result.length < maxResults; i--) {
      var status = String(data[i][idx.status] || '');
      if (status !== '未紐付け') continue;
      
      var receivedAt = data[i][idx.receivedAt];
      var dateStr = '';
      if (receivedAt instanceof Date) {
        dateStr = Utilities.formatDate(receivedAt, 'Asia/Tokyo', 'MM/dd HH:mm');
      } else if (receivedAt) {
        dateStr = String(receivedAt).substring(0, 50);
      }
      
      var lineUserId = String(data[i][idx.lineUserId] || '').substring(0, 50);
      var messageBody = String(data[i][idx.messageBody] || '').substring(0, 200);  // 200文字制限
      
      result.push({
        rowIdx: startRow + i,
        receivedAt: dateStr,
        lineUserId: lineUserId,
        lineUserIdShort: lineUserId.substring(0, 8) + '...',
        displayName: String(data[i][idx.displayName] || '（不明）').substring(0, 50),
        pictureUrl: String(data[i][idx.pictureUrl] || '').substring(0, 500),
        statusMessage: String(data[i][idx.statusMessage] || '').substring(0, 100),
        messageType: String(data[i][idx.messageType] || ''),
        messageBody: messageBody
      });
    }
    
    return result;
  } catch (e) {
    console.error('[getUnlinkedMessages]', e);
    return [];  // エラー時も必ず配列を返す
  }
}

/**
 * メッセージを家族と紐付け
 * - Familiesシートに LINE_USER_ID を書き込み
 * - IncomingMessagesシートのステータスを「紐付け済」に
 */
function linkMessageToFamily(rowIdx, familyId) {
  if (!rowIdx || !familyId) {
    throw new Error('rowIdx と familyId が必要です');
  }
  
  var ss = getSpreadsheet();
  var incoming = ss.getSheetByName('IncomingMessages');
  var families = ss.getSheetByName('Families');
  
  // 1. IncomingMessagesシートから該当行のLINE_USER_IDを取得
  var msgRow = incoming.getRange(rowIdx, 1, 1, 10).getValues()[0];
  var header = incoming.getRange(1, 1, 1, 10).getValues()[0];
  var hIdx = {
    lineUserId: header.indexOf('LINE_USER_ID'),
    displayName: header.indexOf('表示名'),
    status: header.indexOf('紐付けステータス'),
    linkedFamily: header.indexOf('紐付け家族ID'),
    linkedAt: header.indexOf('紐付け日時')
  };
  
  var userId = String(msgRow[hIdx.lineUserId] || '').trim();
  var displayName = String(msgRow[hIdx.displayName] || '').trim();
  
  if (!userId) {
    throw new Error('LINE_USER_IDが取得できませんでした');
  }
  
  // 2. Familiesシートを更新
  var familiesData = families.getDataRange().getValues();
  var fHeader = familiesData[0];
  var fIdx = {
    familyId: fHeader.indexOf('家族ID'),
    name: fHeader.indexOf('宛名'),
    lineUserId: fHeader.indexOf('保護者LINE_USER_ID'),
    registeredAt: fHeader.indexOf('登録日')
  };
  
  var familyRowIdx = -1;
  var familyName = '';
  for (var i = 1; i < familiesData.length; i++) {
    if (familiesData[i][fIdx.familyId] === familyId) {
      familyRowIdx = i;
      familyName = familiesData[i][fIdx.name];
      
      // 二重登録チェック
      if (familiesData[i][fIdx.lineUserId]) {
        throw new Error(familyName + ' は既に登録されています');
      }
      break;
    }
  }
  
  if (familyRowIdx < 0) {
    throw new Error('家族ID ' + familyId + ' が見つかりません');
  }
  
  // Familiesシートに LINE_USER_ID と 登録日 を書き込み
  var cell = families.getRange(familyRowIdx + 1, fIdx.lineUserId + 1);
  cell.setNumberFormat('@');
  cell.setValue(userId);
  if (fIdx.registeredAt >= 0) {
    families.getRange(familyRowIdx + 1, fIdx.registeredAt + 1).setValue(new Date());
  }
  
  // 3. IncomingMessagesシートを更新
  incoming.getRange(rowIdx, hIdx.status + 1).setValue('紐付け済');
  incoming.getRange(rowIdx, hIdx.linkedFamily + 1).setValue(familyId);
  incoming.getRange(rowIdx, hIdx.linkedAt + 1).setValue(new Date());
  
  return {
    success: true,
    familyName: familyName,
    displayName: displayName
  };
}

/**
 * LINE_USER_IDで家族と紐付け（最初に見つかった該当メッセージで紐付け実行）
 */
function linkMessageToFamilyByLineUserId(lineUserId, familyId) {
  if (!lineUserId || !familyId) {
    throw new Error('lineUserId と familyId が必要です');
  }
  
  var ss = getSpreadsheet();
  var incoming = ss.getSheetByName('IncomingMessages');
  var data = incoming.getDataRange().getValues();
  var header = data[0];
  var uidIdx = header.indexOf('LINE_USER_ID');
  var statusIdx = header.indexOf('紐付けステータス');
  
  // 該当USER_IDの未紐付けメッセージで、最初に見つかった行を使う
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][uidIdx]).trim() === String(lineUserId).trim() &&
        data[i][statusIdx] === '未紐付け') {
      return linkMessageToFamily(i + 1, familyId);
    }
  }
  
  throw new Error('該当する未紐付けメッセージが見つかりません');
}

/**
 * メッセージを無視（ステータスのみ更新）
 */
function ignoreMessage(rowIdx) {
  if (!rowIdx) throw new Error('rowIdxが必要です');
  
  var ss = getSpreadsheet();
  var incoming = ss.getSheetByName('IncomingMessages');
  var header = incoming.getRange(1, 1, 1, 10).getValues()[0];
  var statusIdx = header.indexOf('紐付けステータス');
  var linkedAtIdx = header.indexOf('紐付け日時');
  
  incoming.getRange(rowIdx, statusIdx + 1).setValue('無視');
  incoming.getRange(rowIdx, linkedAtIdx + 1).setValue(new Date());
  
  return { success: true };
}

/**
 * 同じLINE_USER_IDの未紐付けメッセージを一括無視
 */
function ignoreMessagesByUserId(lineUserId) {
  if (!lineUserId) throw new Error('LINE_USER_IDが必要です');
  
  var ss = getSpreadsheet();
  var incoming = ss.getSheetByName('IncomingMessages');
  var data = incoming.getDataRange().getValues();
  var header = data[0];
  var uidIdx = header.indexOf('LINE_USER_ID');
  var statusIdx = header.indexOf('紐付けステータス');
  var linkedAtIdx = header.indexOf('紐付け日時');
  
  var count = 0;
  var now = new Date();
  
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][uidIdx]).trim() === String(lineUserId).trim() &&
        data[i][statusIdx] === '未紐付け') {
      incoming.getRange(i + 1, statusIdx + 1).setValue('無視');
      incoming.getRange(i + 1, linkedAtIdx + 1).setValue(now);
      count++;
    }
  }
  
  return { success: true, count: count };
}

// ============================================
// Phase 3-1：Excel取込機能（月次データ取込）
// ============================================

/**
 * 貼り付けTSVデータをパースしてプレビュー用データを返す
 * @param {string} tsvText - Excelからコピーしたタブ区切りテキスト
 * @return {Object} { ok, period, drawDate, families, errors, warnings }
 */
function parseBillingTSV(tsvText) {
  if (!tsvText || typeof tsvText !== 'string') {
    throw new Error('TSVデータが空です');
  }
  
  var lines = tsvText.split(/\r?\n/);
  if (lines.length < 8) {
    throw new Error('TSVデータの行数が不足しています（最低8行必要）');
  }
  
  var result = {
    ok: true,
    period: '',       // 配信月（例：260526）
    drawDate: '',     // 引落日（例：5/26(火)）
    subjectHiki: '',  // 件名（引落）
    subjectChoku: '', // 件名（直払）
    families: [],     // 家族別データ配列
    errors: [],
    warnings: []
  };
  
  // === ヘッダ部の解析（最初の3行） ===
  // 行1: A:空 B:空 C:「引落日」 D:5/26(火) ...
  // 行2: A:空 B:空 C:「件名(引落)」 D:5/26のお引落し金額につきまして
  // 行3: A:空 B:空 C:「件名(直払)」 D:今回分の授業料等につきまして
  
  var row1 = lines[0].split('\t');
  var row2 = lines[1].split('\t');
  var row3 = lines[2].split('\t');
  
// ヘッダ部（最初の数行）のみを対象に「引落日」「件名(引落)」「件名(直払)」を探す
  // データ部のヘッダ行（生徒IDなどが並ぶ行）は除外する
  for (var r = 0; r < 5; r++) {
    var cells = lines[r].split('\t');
    
    // データ部のヘッダ行を検出したら、ヘッダ部の探索を終了
    if (cells.indexOf('生徒ID') >= 0) break;
    
    for (var c = 0; c < cells.length; c++) {
      var cellText = String(cells[c]).trim();
      
      // 完全一致で判定（「引落日」「件名(引落)」「件名(直払)」）
      if (cellText === '引落日' && cells[c+1]) {
        result.drawDate = String(cells[c+1]).trim();
      }
      if (cellText === '件名(引落)' && cells[c+1]) {
        result.subjectHiki = String(cells[c+1]).trim();
      }
      if (cellText === '件名(直払)' && cells[c+1]) {
        result.subjectChoku = String(cells[c+1]).trim();
      }
    }
  }
  
  if (!result.drawDate) {
    result.errors.push('引落日が見つかりません（A〜B列付近に「引落日」というラベルが必要）');
    return result;
  }
  
  // 配信月IDを生成（引落日「5/26(火)」から「260526」を生成は難しいので、現在年月+引落日から推定）
  // 例：引落日が「5/26(火)」なら今年の5月26日 → 「260526」
  result.period = _extractPeriodFromDrawDate(result.drawDate);
  
  // === データ部の解析 ===
  // ヘッダ行を探す（「生徒ID」「学年」「生徒氏名」が並ぶ行）
  var dataHeaderIdx = -1;
  for (var i = 0; i < Math.min(lines.length, 15); i++) {
    if (lines[i].indexOf('生徒ID') >= 0 && lines[i].indexOf('生徒氏名') >= 0) {
      dataHeaderIdx = i;
      break;
    }
  }
  
  if (dataHeaderIdx < 0) {
    result.errors.push('データ部のヘッダ行が見つかりません（「生徒ID」「生徒氏名」を含む行が必要）');
    return result;
  }
  
  var headers = lines[dataHeaderIdx].split('\t');
  var colIdx = {};
  headers.forEach(function(h, idx) {
    var clean = String(h).trim();
    if (clean) colIdx[clean] = idx;
  });
  
  // 必須列チェック
  var requiredCols = ['生徒ID', '生徒氏名', '区分', '宛名', '同一家族', '合計金額'];
  requiredCols.forEach(function(col) {
    if (typeof colIdx[col] === 'undefined') {
      result.errors.push('必須列が見つかりません：' + col);
    }
  });
  if (result.errors.length > 0) return result;
  
  // === 家族ごとに整理 ===
  var familyMap = {};  // familyId → familyData
  
  for (var i = dataHeaderIdx + 1; i < lines.length; i++) {
    var line = lines[i];
    if (!line.trim()) continue;  // 空行スキップ
    
    var cells = line.split('\t');
    var studentIdRaw = String(cells[colIdx['生徒ID']] || '').trim();
    if (!studentIdRaw || isNaN(Number(studentIdRaw))) continue;  // 生徒IDがない行スキップ
    
    var studentId = Number(studentIdRaw);
    var family = String(cells[colIdx['同一家族']] || '').trim();
    var familyId = 'F' + studentId;  // 仮（同一家族=2なら後で家族代表に統合）
    
    // 同一家族=2 の場合、家族代表の生徒IDで紐付け
    // ⚠️ TSVだけでは家族代表が分からない場合があるので、Familiesシートから取得
    if (family === '2' || family === 2) {
      // この行は兄弟の追加分（独立した家族レコードは作らない）
      // 親の家族IDを推測：同じメアドの「同一家族=1」の生徒を探す
      // → Studentsシートから家族IDを引く
      var realFamilyId = _findFamilyIdForStudent(studentId);
      if (realFamilyId) {
        familyId = realFamilyId;
      } else {
        result.warnings.push('生徒ID ' + studentId + ' の家族が特定できません（兄弟分の扱い）');
        continue;
      }
    }
    
    if (!familyMap[familyId]) {
      familyMap[familyId] = {
        familyId: familyId,
        addressee: String(cells[colIdx['宛名']] || '').trim(),
        type: String(cells[colIdx['区分']] || '').trim(),
        totalAmount: 0,
        siblings: []  // 兄弟ごとの項目配列
      };
    }
    
    // 合計金額（家族代表の行のみ）
    if (family === '1' || family === 1) {
      var totalRaw = String(cells[colIdx['合計金額']] || '').trim();
      var total = Number(totalRaw.replace(/[,\s]/g, ''));
      if (!isNaN(total)) {
        familyMap[familyId].totalAmount = total;
      }
    }
    
    // この生徒の兄弟ブロックを生成
    var siblingBlock = _extractSiblingBlock(cells, colIdx, family);
    if (siblingBlock) {
      siblingBlock.studentId = studentId;
      familyMap[familyId].siblings.push(siblingBlock);
    }
  }
  
  // 家族配列に変換
  result.families = Object.keys(familyMap).map(function(fid) {
    return familyMap[fid];
  });
  
  return result;
}

/**
 * 引落日テキスト（「5/26(火)」「2026/5/26」等）から配信月ID（YYMMDD）を抽出
 */
function _extractPeriodFromDrawDate(drawDate) {
  // パターン1: "5/26(火)" or "5/26" → 当年を補完
  var m = String(drawDate).match(/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    var year = new Date().getFullYear() % 100;
    var month = ('00' + m[1]).slice(-2);
    var day = ('00' + m[2]).slice(-2);
    return ('00' + year).slice(-2) + month + day;
  }
  // パターン2: "2026/5/26"
  var m2 = String(drawDate).match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m2) {
    var year = Number(m2[1]) % 100;
    return ('00' + year).slice(-2) + ('00' + m2[2]).slice(-2) + ('00' + m2[3]).slice(-2);
  }
  return '';
}

/**
 * Studentsシートから、ある生徒の家族IDを引く
 */
function _findFamilyIdForStudent(studentId) {
  try {
    var ss = getSpreadsheet();
    var students = ss.getSheetByName('Students');
    var data = students.getDataRange().getValues();
    var header = data[0];
    var sidIdx = header.indexOf('生徒ID');
    var fidIdx = header.indexOf('家族ID');
    if (sidIdx < 0 || fidIdx < 0) return null;
    
    for (var i = 1; i < data.length; i++) {
      if (Number(data[i][sidIdx]) === Number(studentId)) {
        return String(data[i][fidIdx] || '').trim();
      }
    }
    return null;
  } catch (e) {
    console.error('[_findFamilyIdForStudent]', e);
    return null;
  }
}

/**
 * 1行から、その生徒の兄弟ブロック（呼称＋項目配列）を抽出
 * Excel構造：
 *   - 同一家族=1：兄弟名１＋項目11〜19、兄弟名２＋項目21〜29、兄弟名３＋項目31〜39
 *   - 同一家族=2：（家族代表行の兄弟名２に該当）
 * @return { siblingName, items: [{label, amount}] }
 */
function _extractSiblingBlock(cells, colIdx, familyType) {
  // 同一家族=1 の行：兄弟名１の項目を使う（自分が長子の場合）
  // 同一家族=2 の行：その行自体は項目を持たない（家族代表の兄弟名2に項目がある）
  
  // 仕様簡略化：同一家族=1 の行はその行内の項目11〜19、項目21〜29、項目31〜39 すべてを処理
  if (familyType === '1' || familyType === 1) {
    // 兄弟ブロック1（11〜19）と兄弟ブロック2（21〜29）と兄弟ブロック3（31〜39）に分けて返す
    var blocks = [];
    
    for (var b = 1; b <= 3; b++) {
      var siblingNameCol = '兄弟名' + _toFullwidthDigit(b);
      var siblingName = String(cells[colIdx[siblingNameCol]] || '').trim();
      
      var items = [];
      for (var i = 1; i <= 10; i++) {
        var itemCol = '項目' + _toFullwidthDigit(b) + _toFullwidthDigit(i);
        var amountCol = '金額' + _toFullwidthDigit(b) + _toFullwidthDigit(i);
        if (typeof colIdx[itemCol] === 'undefined') continue;
        
        var label = String(cells[colIdx[itemCol]] || '').trim();
        var amountRaw = String(cells[colIdx[amountCol]] || '').trim();
        var amount = Number(amountRaw.replace(/[,\s]/g, ''));
        
        if (label && !isNaN(amount) && amount > 0) {
          items.push({ label: label, amount: amount });
        }
      }
      
      // 項目が1つでもあれば、そのブロックを返す（兄弟名は空でもOK＝1人っ子の場合）
      if (items.length > 0) {
        blocks.push({ siblingName: siblingName, items: items });
      }
    }
    
    return blocks.length > 0 ? blocks : null;
  }
  
  // 同一家族=2 の行は、独立した項目を持たないのでスキップ
  return null;
}

/**
 * 半角数字→全角数字変換（1→１）
 */
function _toFullwidthDigit(n) {
  var s = String(n);
  return s.replace(/[0-9]/g, function(d) {
    return String.fromCharCode(0xFF10 + parseInt(d, 10));
  });
}

/**
 * パース結果を取り込んで Billings/BillingItems シートに書き込む
 * @param {Object} parsed - parseBillingTSV の戻り値
 * @return {Object} 取込結果
 */
function importBillingData(parsed) {
  if (!parsed || !parsed.ok || !parsed.period) {
    throw new Error('取込データが不正です');
  }
  
  var ss = getSpreadsheet();
  var billings = ss.getSheetByName('Billings');
  var items = ss.getSheetByName('BillingItems');
  
  if (!billings) throw new Error('Billingsシートがありません');
  if (!items) throw new Error('BillingItemsシートがありません');
  
  // 既存の同月データを削除（再取込対応）
  _deleteExistingBillingsByPeriod(parsed.period);
  
  var billingsRows = [];
  var itemsRows = [];
  
  // siblings 配列はネスト構造（家族 → 兄弟ブロック群 → 項目群）
  parsed.families.forEach(function(fam) {
    // 各家族の siblings は配列の配列（複数の_extractSiblingBlockの結果）
    var flatSiblings = [];
    fam.siblings.forEach(function(blockArr) {
      if (Array.isArray(blockArr)) {
        blockArr.forEach(function(b) { flatSiblings.push(b); });
      } else if (blockArr) {
        flatSiblings.push(blockArr);
      }
    });
    
    // 配信本文生成
    var body = _generateBillingBody(fam, flatSiblings, parsed.drawDate);
    
    // Billings行
    billingsRows.push([
      parsed.period,         // 配信月
      fam.familyId,          // 家族ID
      fam.totalAmount,       // 合計金額
      parsed.drawDate,       // 引落日
      body,                  // 配信本文
      '未配信',               // 配信ステータス
      '',                    // 配信日時
      ''                     // エラー詳細
    ]);
    
    // BillingItems行（兄弟ブロックごとに）
    flatSiblings.forEach(function(sibling, sIdx) {
      sibling.items.forEach(function(item, iIdx) {
        itemsRows.push([
          parsed.period,                    // 配信月
          fam.familyId,                     // 家族ID
          sibling.studentId || '',          // 生徒ID
          sibling.siblingName || '',        // 兄弟呼称
          item.label,                       // 項目名
          item.amount,                      // 金額
          sIdx * 10 + iIdx + 1              // 表示順
        ]);
      });
    });
  });
  
  // 一括書き込み
  if (billingsRows.length > 0) {
    billings.getRange(billings.getLastRow() + 1, 1, billingsRows.length, 8).setValues(billingsRows);
  }
  if (itemsRows.length > 0) {
    items.getRange(items.getLastRow() + 1, 1, itemsRows.length, 7).setValues(itemsRows);
  }
  
  return {
    success: true,
    period: parsed.period,
    familyCount: parsed.families.length,
    itemCount: itemsRows.length
  };
}

/**
 * 配信本文を生成（Word差し込み印刷を踏襲）
 */
function _generateBillingBody(family, siblings, drawDate) {
  var msg = family.addressee + '\n\n';
  
  if (family.type === '自') {
    // 自動引落版
    msg += 'お世話になっております。次回' + drawDate + 'のお引落し金額についてご連絡いたします。\n\n';
    msg += '引落し合計金額 ・・ ' + Number(family.totalAmount).toLocaleString() + '円　（内訳は下記をご確認ください。）\n\n';
  } else {
    // 直接持参版
    msg += 'お世話になっております。\n';
    msg += '今月はご持参いただく金額が以下の通りとなりますのでご連絡いたします。\n';
    msg += 'こちらを、「' + drawDate + 'まで」にお持ちください。\n\n';
    msg += '合計金額 ・・ ' + Number(family.totalAmount).toLocaleString() + '円　（内訳は下記をご確認ください。）\n\n';
  }
  
  msg += '●金額の内訳\n\n';
  
  if (siblings.length === 1 && !siblings[0].siblingName) {
    // 1人っ子・兄弟名なし
    siblings[0].items.forEach(function(item) {
        var prefix = (item.label.charAt(0) === '・') ? '' : '・';
        msg += prefix + item.label + '　　' + Number(item.amount).toLocaleString() + '円\n';
    });
  } else {
    // 兄弟あり
    siblings.forEach(function(sib) {
      if (sib.siblingName) {
        var sibName = sib.siblingName;
        // 既に【】で囲まれていればそのまま、なければ追加
        if (sibName.charAt(0) !== '【') {
          sibName = '【' + sibName + '】';
        }
        msg += sibName + '\n';
      }
      sib.items.forEach(function(item) {
        var prefix = (item.label.charAt(0) === '・') ? '' : '・';
        msg += prefix + item.label + '　　' + Number(item.amount).toLocaleString() + '円\n';
      });
      msg += '\n';
    });
  }
  
  msg += '\n以上、よろしくお願いいたします。\n\n福地';
  return msg;
}

/**
 * 既存の同月データを削除
 */
function _deleteExistingBillingsByPeriod(period) {
  var ss = getSpreadsheet();
  ['Billings', 'BillingItems'].forEach(function(sheetName) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return;
    
    // periodは1列目（A列）想定
    var rowsToDelete = [];
    for (var i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]) === String(period)) {
        rowsToDelete.push(i + 1);
      }
    }
    rowsToDelete.forEach(function(rowNum) {
      sheet.deleteRow(rowNum);
    });
  });
}

/**
 * テスト：サンプルTSVをパースして結果を確認
 */
function _testParseBillingTSV() {
  // ダミーTSV（実際のExcelからコピーした想定）
  var tsv = [
    '\t\t引落日\t5/26(火)\t\t備考消す！',
    '\t\t件名(引落)\t5/26のお引落し金額につきまして',
    '\t\t件名(直払)\t今回分の授業料等につきまして',
    '',
    '番号\t生徒ID\t学年\t生徒氏名\tアドレス\t区分\t名字数\t宛名\t同一家族\t合計金額\t引落日\t兄弟名１\t項目１１\t金額１１\t項目１２\t金額１２',
    '1\t20014\t高2\t藤本　晴\ttest@example.com\t自\t2\t藤本様\t1\t13200\t5/26(火)\t\t６月分授業料\t11000\t維持費\t2200'
  ].join('\n');
  
  var result = parseBillingTSV(tsv);
  Logger.log('結果: ' + JSON.stringify(result, null, 2));
}

// ============================================
// Phase 3-2：配信プレビュー機能
// ============================================

/**
 * 配信月の一覧を取得（Billingsシートから）
 */
function getBillingPeriods() {
  var ss = getSpreadsheet();
  var billings = ss.getSheetByName('Billings');
  if (!billings) return [];
  
  var data = billings.getDataRange().getValues();
  if (data.length < 2) return [];
  
  var periods = {};
  for (var i = 1; i < data.length; i++) {
    var p = String(data[i][0] || '').trim();
    if (p) periods[p] = (periods[p] || 0) + 1;
  }
  
  return Object.keys(periods)
    .sort(function(a, b) { return b.localeCompare(a); })  // 新しい順
    .map(function(p) { return { period: p, count: periods[p] }; });
}

/**
 * 指定月の Billings 一覧を取得（家族情報・配信本文付き）
 */
function getBillingsByPeriod(period) {
  if (!period) throw new Error('配信月を指定してください');
  
  var ss = getSpreadsheet();
  var billings = ss.getSheetByName('Billings');
  var families = ss.getSheetByName('Families');
  
  if (!billings || !families) throw new Error('Billings/Familiesシートが見つかりません');
  
  var billingsData = billings.getDataRange().getValues();
  var familiesData = families.getDataRange().getValues();
  
  var bHeader = billingsData[0];
  var bIdx = {
    period: bHeader.indexOf('配信月'),
    familyId: bHeader.indexOf('家族ID'),
    totalAmount: bHeader.indexOf('合計金額'),
    drawDate: bHeader.indexOf('引落日'),
    body: bHeader.indexOf('配信本文'),
    status: bHeader.indexOf('配信ステータス'),
    sentAt: bHeader.indexOf('配信日時')
  };
  
  var fHeader = familiesData[0];
  var fIdx = {
    familyId: fHeader.indexOf('家族ID'),
    name: fHeader.indexOf('宛名'),
    type: fHeader.indexOf('配信区分'),
    lineUserId: fHeader.indexOf('保護者LINE_USER_ID')
  };
  
  // 家族情報マップ
  var familyMap = {};
  for (var i = 1; i < familiesData.length; i++) {
    var fid = familiesData[i][fIdx.familyId];
    if (fid) {
      familyMap[fid] = {
        name: familiesData[i][fIdx.name] || '',
        type: familiesData[i][fIdx.type] || '',
        hasLineUserId: !!familiesData[i][fIdx.lineUserId]
      };
    }
  }
  
  // Billingsから該当月を抽出
  var result = [];
  for (var i = 1; i < billingsData.length; i++) {
    if (String(billingsData[i][bIdx.period]) !== String(period)) continue;
    
    var fid = billingsData[i][bIdx.familyId];
    var fam = familyMap[fid] || {};
    
    result.push({
      rowIdx: i + 1,
      familyId: fid,
      addressee: fam.name,
      type: fam.type,
      hasLineUserId: fam.hasLineUserId,
      totalAmount: Number(billingsData[i][bIdx.totalAmount]) || 0,
      drawDate: billingsData[i][bIdx.drawDate],
      body: String(billingsData[i][bIdx.body] || ''),
      status: billingsData[i][bIdx.status],
      sentAt: billingsData[i][bIdx.sentAt]
    });
  }
  
  // 家族IDでソート
  result.sort(function(a, b) {
    return String(a.familyId).localeCompare(String(b.familyId));
  });
  
  return result;
}

/**
 * 配信本文を個別更新
 */
function updateBillingBody(rowIdx, newBody) {
  if (!rowIdx || typeof newBody !== 'string') {
    throw new Error('rowIdx と newBody が必要です');
  }
  
  var ss = getSpreadsheet();
  var billings = ss.getSheetByName('Billings');
  var header = billings.getRange(1, 1, 1, billings.getLastColumn()).getValues()[0];
  var bodyIdx = header.indexOf('配信本文');
  
  if (bodyIdx < 0) throw new Error('配信本文列が見つかりません');
  
  billings.getRange(rowIdx, bodyIdx + 1).setValue(newBody);
  
  return { success: true };
}

// ============================================
// Phase 3-3：テスト配信機能
// ============================================

/**
 * 管理者（ふくちさん）のLINE_USER_IDを取得
 */
function _getAdminLineUserId() {
  try {
    return String(PropertiesService.getScriptProperties().getProperty('ADMIN_LINE_USER_ID') || '').trim();
  } catch (e) {
    return '';
  }
}

/**
 * テスト配信：単一家族の配信本文を管理者LINEに送る
 * @param {number} rowIdx - Billingsシートの行番号（1-based）
 * @return {Object} 結果
 */
function testSendBillingToAdmin(rowIdx) {
  if (!rowIdx) throw new Error('rowIdxが必要です');
  
  var adminId = _getAdminLineUserId();
  if (!adminId) {
    throw new Error('ADMIN_LINE_USER_IDが未設定です。スクリプトプロパティに登録してください。');
  }
  
  var ss = getSpreadsheet();
  var billings = ss.getSheetByName('Billings');
  var header = billings.getRange(1, 1, 1, billings.getLastColumn()).getValues()[0];
  var bodyIdx = header.indexOf('配信本文');
  var familyIdIdx = header.indexOf('家族ID');
  
  var row = billings.getRange(rowIdx, 1, 1, billings.getLastColumn()).getValues()[0];
  var body = String(row[bodyIdx] || '').trim();
  var familyId = String(row[familyIdIdx] || '');
  
  if (!body) throw new Error('配信本文が空です');
  
  // テスト配信であることを明示するヘッダを追加
  var testBody = '🧪 テスト配信【' + familyId + '】\n' +
                 '━━━━━━━━━━━━━\n\n' + body;
  
  var sendResult = _pushLineMessage(adminId, testBody);
  
  return {
    success: sendResult.success,
    familyId: familyId,
    error: sendResult.error || ''
  };
}

/**
 * テスト配信：指定月の全家族分を管理者LINEに連続送信
 * @param {string} period - 配信月（例：260526）
 * @return {Object} 結果
 */
function testSendAllBillingsToAdmin(period) {
  if (!period) throw new Error('配信月を指定してください');
  
  var adminId = _getAdminLineUserId();
  if (!adminId) {
    throw new Error('ADMIN_LINE_USER_IDが未設定です。');
  }
  
  var ss = getSpreadsheet();
  var billings = ss.getSheetByName('Billings');
  var data = billings.getDataRange().getValues();
  var header = data[0];
  
  var bIdx = {
    period: header.indexOf('配信月'),
    familyId: header.indexOf('家族ID'),
    body: header.indexOf('配信本文')
  };
  
  // 該当月のデータだけ抽出
  var targets = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][bIdx.period]) === String(period)) {
      targets.push({
        familyId: data[i][bIdx.familyId],
        body: String(data[i][bIdx.body] || '')
      });
    }
  }
  
  if (targets.length === 0) {
    throw new Error('該当月のデータがありません');
  }
  
  // 開始通知
  var startMsg = '🧪 テスト配信開始\n配信月：' + period + '\n対象：' + targets.length + '家族';
  _pushLineMessage(adminId, startMsg);
  Utilities.sleep(500);
  
  // 連続送信
  var successCount = 0;
  var errorCount = 0;
  var errors = [];
  
  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    if (!t.body) {
      errorCount++;
      errors.push(t.familyId + ': 本文なし');
      continue;
    }
    
    var testBody = '🧪 ' + (i + 1) + '/' + targets.length + ' 【' + t.familyId + '】\n' +
                   '━━━━━━━━━━━━━\n\n' + t.body;
    
    var sendResult = _pushLineMessage(adminId, testBody);
    if (sendResult.success) {
      successCount++;
    } else {
      errorCount++;
      errors.push(t.familyId + ': ' + (sendResult.error || '不明エラー'));
    }
    
    // レート制限緩和（500ms間隔）
    Utilities.sleep(500);
  }
  
  // 完了通知
  var endMsg = '✅ テスト配信完了\n成功：' + successCount + '\n失敗：' + errorCount;
  _pushLineMessage(adminId, endMsg);
  
  return {
    success: errorCount === 0,
    totalCount: targets.length,
    successCount: successCount,
    errorCount: errorCount,
    errors: errors
  };
}

/**
 * LINE Messaging API でメッセージ送信
 * @return {Object} { success, error, status }
 */
function _pushLineMessage(userId, text) {
  var token = _getLineMessagingAccessToken();
  if (!token) {
    return { success: false, error: 'LINE_MESSAGING_CHANNEL_ACCESS_TOKEN 未設定' };
  }
  
  try {
    var res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      payload: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: text }]
      }),
      muteHttpExceptions: true
    });
    
    var status = res.getResponseCode();
    if (status === 200) {
      return { success: true, status: status };
    } else {
      return {
        success: false,
        status: status,
        error: 'HTTP ' + status + ': ' + res.getContentText().substring(0, 200)
      };
    }
  } catch (e) {
    return { success: false, error: String(e) };
  }
}