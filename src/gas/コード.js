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