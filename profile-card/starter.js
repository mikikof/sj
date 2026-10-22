window.STARTER = {
  html: `<!-- 「ここを変える」の次の行にある文字を、自分の内容に書き換えよう。 -->
<article class="profile-card">
  <div class="accent-line"></div>

  <div class="card-content">
    <header class="profile-header">
      <div>
        <!-- ここを変える：学校名 -->
        <p class="school-name">品川女子学院</p>
        <!-- ここを変える：氏名（イニシャルや仮の名前でもOK） -->
        <h1 class="user-name">小船 幹生</h1>
        <!-- ここを変える：学年 -->
        <p class="grade">中学1年生（見本）</p>
      </div>
      <!-- ここを変える：丸いアイコンの中の文字 -->
      <div class="profile-icon">MK</div>
    </header>

    <section class="basic-profile">
      <!-- ここを変える：見出し「基本プロフィール」 -->
      <h2>基本プロフィール</h2>
      <div class="basic-fields">
        <p class="basic-field">
          <!-- ここを変える：項目名「クラス」 -->
          <span>クラス</span>
          <!-- ここを変える：クラス -->
          <strong>⚪︎</strong>
        </p>
        <p class="basic-field">
          <!-- ここを変える：項目名「出席番号」 -->
          <span>出席番号</span>
          <!-- ここを変える：出席番号 -->
          <strong>◼︎</strong>
        </p>
      </div>
    </section>

    <dl class="profile-details">
      <div class="detail-row">
        <!-- ここを変える：項目名「部活・委員会」 -->
        <dt>部活・委員会</dt>
        <!-- ここを変える：部活・委員会 -->
        <dd>水泳部</dd>
      </div>
      <div class="detail-row">
        <!-- ここを変える：項目名「MBTI」 -->
        <dt>MBTI</dt>
        <!-- ここを変える：MBTI -->
        <dd>論理学者</dd>
      </div>
      <div class="detail-row">
        <!-- ここを変える：項目名「推し」 -->
        <dt>推し</dt>
        <!-- ここを変える：推し -->
        <dd>シーサー（ちいかわ）</dd>
      </div>
      <div class="detail-row">
        <!-- ここを変える：項目名「好きなこと」 -->
        <dt>好きなこと</dt>
        <!-- ここを変える：好きなこと -->
        <dd>読書</dd>
      </div>
    </dl>

    <section class="future-box">
      <!-- ここを変える：見出し「なりたい職業」 -->
      <h2>なりたい職業</h2>
      <!-- ここを変える：なりたい職業 -->
      <p class="future-job">眼鏡職人</p>
    </section>

    <section class="comment-box">
      <!-- ここを変える：項目名「最近のひとこと」 -->
      <h2>最近のひとこと</h2>
      <!-- ここを変える：最近のひとこと -->
      <p class="recent-comment">早くお正月が来てほしい</p>
    </section>
  </div>
</article>`,
  css: `/* ここを変える：カードのアクセント色と、画面全体の背景色 */
:root {
  /* ここを変える：見出しや上の線に使う色 */
  --accent: #244f80;
  /* ここを変える：カードの外側の背景色 */
  --page-bg: #edf2f8;
}

/* ここを変える：幅に余白や枠線を含める計算方法（通常はこのまま） */
* {
  box-sizing: border-box;
}

/* ここを変える：画面全体の配置、背景、文字の基本設定 */
body {
  /* ここを変える：画面の外側と内側の余白 */
  margin: 0;
  padding: 20px 16px;
  /* ここを変える：画面の高さとカードの置き場所 */
  min-height: 100vh;
  display: grid;
  place-items: center;
  /* ここを変える：画面全体の背景色 */
  background: var(--page-bg);
  /* ここを変える：基本の文字の色 */
  color: #172b43;
  /* ここを変える：文字の種類 */
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
  /* ここを変える：基本の文字の大きさ、太さ、行の間隔 */
  font-size: 18px;
  font-weight: 600;
  line-height: 1.6;
}

/* ここを変える：カード全体の大きさと見た目 */
.profile-card {
  /* ここを変える：カードの横幅 */
  width: 100%;
  max-width: 580px;
  /* ここを変える：角からはみ出す部分の表示方法 */
  overflow: hidden;
  /* ここを変える：カードの背景色 */
  background: #ffffff;
  /* ここを変える：枠線の太さ、種類、色 */
  border: 2px solid #c5d2e1;
  /* ここを変える：角の丸さ */
  border-radius: 20px;
  /* ここを変える：影の位置、広がり、色 */
  box-shadow: 0 10px 30px #20395214;
}

/* ここを変える：カードの上にある色の線 */
.accent-line {
  /* ここを変える：線の太さ */
  height: 6px;
  /* ここを変える：線の色と、色が切り替わる位置 */
  background: linear-gradient(90deg, var(--accent) 0%, var(--accent) 70%, #e5bacb 70%);
}

/* ここを変える：カードの内側の余白 */
.card-content {
  padding: 24px;
}

/* ここを変える：名前のまとまりとアイコンの並べ方 */
.profile-header {
  /* ここを変える：横並びの方法と、上下左右の位置 */
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* ここを変える：名前とアイコンの間隔、次の項目までの余白 */
  gap: 16px;
  margin-bottom: 20px;
}

/* ここを変える：学校名の見た目 */
.school-name {
  /* ここを変える：学校名の下の余白 */
  margin: 0 0 4px;
  /* ここを変える：学校名の文字の色 */
  color: var(--accent);
  /* ここを変える：学校名の文字の大きさ、太さ、行の間隔 */
  font-size: 18px;
  font-weight: 800;
  line-height: 1.5;
}

/* ここを変える：名前の見た目 */
.user-name {
  /* ここを変える：名前の周囲の余白 */
  margin: 0;
  /* ここを変える：名前の文字の大きさ、太さ、行の間隔 */
  font-size: 32px;
  font-weight: 800;
  line-height: 1.35;
  /* ここを変える：長い名前を折り返す方法 */
  overflow-wrap: anywhere;
}

/* ここを変える：学年の見た目 */
.grade {
  /* ここを変える：学年の上の余白 */
  margin: 4px 0 0;
  /* ここを変える：学年の文字の色 */
  color: #334155;
  /* ここを変える：学年の文字の大きさ、太さ、行の間隔 */
  font-size: 18px;
  font-weight: 600;
  line-height: 1.5;
}

/* ここを変える：丸いアイコンの見た目 */
.profile-icon {
  /* ここを変える：狭い画面でアイコンを縮めるかどうか */
  flex-shrink: 0;
  /* ここを変える：アイコンの横幅と高さ */
  width: 58px;
  height: 58px;
  /* ここを変える：アイコン内の文字の位置 */
  display: grid;
  place-items: center;
  /* ここを変える：アイコンの枠線と丸さ */
  border: 2px solid #becfe0;
  border-radius: 50%;
  /* ここを変える：アイコンの背景色と文字の色 */
  background: #e9f0f8;
  color: var(--accent);
  /* ここを変える：アイコンの文字の大きさと太さ */
  font-size: 20px;
  font-weight: 800;
}

/* ここを変える：基本プロフィールの囲みの見た目 */
.basic-profile {
  /* ここを変える：囲みの内側と下の余白 */
  padding: 12px 16px;
  margin-bottom: 22px;
  /* ここを変える：囲みの背景色、枠線、角の丸さ */
  background: #f3f6fa;
  border: 1px solid #c5d2e1;
  border-radius: 10px;
  /* ここを変える：基本プロフィールの文字の大きさ */
  font-size: 16px;
}

/* ここを変える：「基本プロフィール」という見出しの見た目 */
.basic-profile h2 {
  /* ここを変える：見出しの下の余白 */
  margin: 0 0 6px;
  /* ここを変える：見出しの色、大きさ、太さ */
  color: var(--accent);
  font-size: 16px;
  font-weight: 800;
}

/* ここを変える：クラスと出席番号の並べ方 */
.basic-fields {
  /* ここを変える：横並びと、狭い画面での折り返し */
  display: flex;
  flex-wrap: wrap;
  /* ここを変える：項目どうしの縦と横の間隔 */
  gap: 6px 24px;
}

/* ここを変える：基本プロフィールのラベルと内容の並べ方 */
.basic-field {
  /* ここを変える：ラベルと内容の間隔、周囲の余白 */
  display: flex;
  gap: 10px;
  margin: 0;
  /* ここを変える：長い内容を折り返す方法 */
  overflow-wrap: anywhere;
}

/* ここを変える：基本プロフィールの内容の太さ */
.basic-field strong {
  font-weight: 800;
}

/* ここを変える：自己紹介の項目全体の並びと間隔 */
.profile-details {
  /* ここを変える：項目の並べ方と、項目どうしの間隔 */
  display: grid;
  gap: 12px;
  /* ここを変える：項目全体の下の余白 */
  margin: 0 0 22px;
}

/* ここを変える：1つの項目のラベルと内容の並べ方 */
.detail-row {
  /* ここを変える：ラベルの列幅と、内容の列幅 */
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr);
  /* ここを変える：ラベルと内容の間隔、上下の位置 */
  gap: 14px;
  align-items: baseline;
}

/* ここを変える：「推し」などの項目名の見た目 */
.detail-row dt {
  /* ここを変える：項目名の文字の色 */
  color: #334155;
  /* ここを変える：項目名の文字の大きさと太さ */
  font-size: 16px;
  font-weight: 800;
}

/* ここを変える：「シーサー」などの内容の見た目 */
.detail-row dd {
  /* ここを変える：内容の周囲の余白 */
  margin: 0;
  /* ここを変える：内容の文字の大きさと太さ */
  font-size: 18px;
  font-weight: 600;
  /* ここを変える：長い内容を折り返す方法 */
  overflow-wrap: anywhere;
}

/* ここを変える：「なりたい職業」の独立した囲みの見た目 */
.future-box {
  /* ここを変える：囲みの内側と下の余白 */
  padding: 16px 18px;
  margin-bottom: 16px;
  /* ここを変える：囲みの背景色、枠線、角の丸さ */
  background: #ffffff;
  border: 2px solid #c5d2e1;
  border-radius: 12px;
}

/* ここを変える：「なりたい職業」という見出しの見た目 */
.future-box h2 {
  /* ここを変える：見出しの下の余白 */
  margin: 0 0 6px;
  /* ここを変える：見出しの文字の色、大きさ、太さ */
  color: var(--accent);
  font-size: 16px;
  font-weight: 800;
}

/* ここを変える：なりたい職業の本文の見た目 */
.future-job {
  /* ここを変える：本文の周囲の余白 */
  margin: 0;
  /* ここを変える：本文の文字の大きさと太さ */
  font-size: 20px;
  font-weight: 800;
  /* ここを変える：長い内容を折り返す方法 */
  overflow-wrap: anywhere;
}

/* ここを変える：「最近のひとこと」の囲みの見た目 */
.comment-box {
  /* ここを変える：囲みの内側の余白と角の丸さ */
  padding: 16px 18px;
  border-radius: 12px;
  /* ここを変える：囲みの背景色 */
  background: #edf3fa;
  /* ここを変える：左側の線の太さと色 */
  border-left: 4px solid #d89bb3;
}

/* ここを変える：「最近のひとこと」という見出しの見た目 */
.comment-box h2 {
  /* ここを変える：見出しの下の余白 */
  margin: 0 0 6px;
  /* ここを変える：見出しの文字の色 */
  color: var(--accent);
  /* ここを変える：見出しの文字の大きさと太さ */
  font-size: 16px;
  font-weight: 800;
}

/* ここを変える：ひとことの本文の見た目 */
.recent-comment {
  /* ここを変える：本文の周囲の余白 */
  margin: 0;
  /* ここを変える：本文の文字の大きさと太さ */
  font-size: 18px;
  font-weight: 600;
  /* ここを変える：長いひとことを折り返す方法 */
  overflow-wrap: anywhere;
}

/* ここを変える：画面が狭いときに縦並びへ切り替える幅 */
@media (max-width: 420px) {
  /* ここを変える：狭い画面でのラベルと内容の並び方 */
  .detail-row {
    /* ここを変える：ラベルと内容を1列で縦に並べる */
    grid-template-columns: 1fr;
    /* ここを変える：縦並びになったラベルと内容の間隔 */
    gap: 3px;
  }
}
`
};
