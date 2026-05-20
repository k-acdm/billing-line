/**
 * billing-line：月次引き落とし配信システム
 * 初期動作確認用コード
 */

// スクリプトプロパティから設定値を取得
function getConfig() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID'),
    lineChannelAccessToken: props.getProperty('LINE_CHANNEL_ACCESS_TOKEN'),
    adminLineUserIds: props.getProperty('ADMIN_LINE_USER_IDS')
  };
}

/**
 * 動作確認：スプレッドシートに接続して、6シートの存在を確認する
 */
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
    
    Logger.log('期待するシート：' + expectedSheets.join(', '));
    Logger.log('実際のシート：' + actualSheets.join(', '));
    
    const missing = expectedSheets.filter(name => !actualSheets.includes(name));
    if (missing.length === 0) {
      Logger.log('✅ 6シートすべて存在を確認');
    } else {
      Logger.log('❌ 不足シート：' + missing.join(', '));
    }
    
    // 各シートの1行目（ヘッダ）も確認
    expectedSheets.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        Logger.log(`  [${name}] ヘッダ：${headers.join(' | ')}`);
      }
    });
    
  } catch (e) {
    Logger.log('❌ エラー：' + e.toString());
  }
}