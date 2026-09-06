# 文言字詞卡

691 張文言字詞 flashcard，12 篇，靜態網站。點卡翻面，支援章節篩選、搜尋、洗牌，外加 SM-2 間隔重複，進度存在瀏覽器 localStorage。

## 開發

```sh
npm install
npm run dev
```

## 資料

`answers.md` 是原始檔，不進版控。改完後跑：

```sh
node scripts/parse-answers.mjs
```

會產生 `src/data/cards.json` 跟 `src/data/chapters.json`，這兩個才進版控。

原始格式：`題號. 原句（關鍵字用 **粗體**）｜答案：Y`，章節用 `## ` 開頭。

## 部署

靜態輸出 `dist/`，`npm run build` 即可，Vercel 或 Netlify 都能直接吃。
