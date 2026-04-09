企業智慧學習平台：全流程部署與營運手冊

適用網域：deepmystic.net | 核心引擎：DeepSeek AI | 儲存：Cloudflare KV

壹、 系統架構概觀 (The Architecture)

本系統採用「前後端全整合」架構，所有零件均存放於您的專屬網域內，確保在大陸境內擁有最高的連線優先權。

門牌 (網域)：deepmystic.net (Cloudflare 託管)。

店面 (前端)：index.html (存放於 GitHub，透過 Cloudflare Pages 發布)。

大腦 (後端)：functions/api/[[path]].js (Pages Functions，負責處理 AI 與數據)。

金庫 (資料庫)：Cloudflare KV (STUDY_STORAGE)，存放發布後的考題。

貳、 檔案結構與 GitHub 管理 (GitHub Setup)

GitHub 是系統的原始碼倉庫。請確保您的儲存庫 (Repo) 結構嚴格遵守以下路徑：

1. 根目錄文件

index.html：使用者介面檔案。

functions/ (資料夾)：

api/ (子資料夾)：

[[path]].js：後端邏輯檔案（包含 API Key）。

2. 更新機制

您只要在 GitHub 網頁上編輯檔案並點擊 「Commit changes」，Cloudflare Pages 會在 1 分鐘內自動感應並完成全網同步，無需手動重新發布。

參、 Cloudflare 後台關鍵設定 (Cloudflare Configuration)

這是系統能「通電」運作的核心步驟，若出現 Code 500 錯誤，通常是這裡的設定失效。

1. KV 命名空間 (金庫)

路徑：儲存空間和資料庫 -> KV。

名稱：STUDY_STORAGE。

2. 函式繫結 (授權存取)

這是最重要的「轉發」動作，讓網頁有權利讀寫金庫：

進入 「Workers 和 Pages」 -> 點擊您的 Pages 專案。

點擊 「設定」 (Settings) -> 「函式」 (Functions)。

找到 「KV 命名空間繫結」。

點擊 「新增繫結」：

變數名稱：STUDY_DB (必須全大寫，一字不差)。

KV 命名空間：選擇 STUDY_STORAGE。

點擊 「儲存」。

肆、 管理員營運流程 (Admin Operations)

1. 登入與環境檢查

造訪 https://deepmystic.net。

檢查左上角連線燈號：

🟢 綠燈：系統完全正常。

🔴 紅燈：API 連線中斷，請檢查 Cloudflare 繫結。

2. 智能出題三部曲

導入素材：支援 PDF、Word、圖片或手動貼入。

出題設定：點擊「AI 智能出題」後，選擇題數。點擊下方跳出的 「🚀 開始出題」。

人工校閱：AI 生成後，您可以直接在網頁上修改題目文字、選項或解析。

3. 正式發布

填寫「卷宗名稱」（單元標題）。

點擊 「🚀 正式發布至雲端」。一旦顯示成功，全行同仁的手機端會立刻同步看到。

伍、 常見錯誤排除 (Troubleshooting)

錯誤代碼 / 現象

可能原因

解決方法

Code 405

API 路徑或檔案位置不對

檢查 GitHub 檔案是否位於 functions/api/[[path]].js。

Code 500

金庫未授權

確認 Pages 設定中的 KV 繫結變數名為 STUDY_DB。

Failed to fetch

網域解析尚未完全生效

等待 10-30 分鐘，或嘗試切換 4G/5G 網路。

題目沒更新

瀏覽器快取 (Cache) 影響

點擊首頁下方的「強制刷新數據連線」或使用無痕模式。

陸、 未來擴充建議 (Future Expansion)

多分行管理：若要分開管理不同部門，可透過在 functions/api/[[path]].js 增加用戶驗證邏輯。

安全性升級：可在 Cloudflare 開啟 Zero Trust，限制只有分行內部人員的 Email 才能存取。

數據分析：目前資料庫僅存儲題目。未來可擴充「成績單」功能，將同仁答題紀錄存回 KV。

行長的話：
「知識是銀行的核心資產，AI 是轉化資產的加速器。願此系統成為分行精進業務的強大助力。」
