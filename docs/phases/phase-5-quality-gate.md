# Phase 5: Quality Gate

## ゴール
外部提示前に品質の当たり外れを潰す。

## 検査
1. Lighthouse（performance/accessibility/seo/best-practices）
2. リンク切れ
3. 見出し構造（H1-H3）
4. content hashカバレッジ

## 再生成
不合格時は以下のみ自動補正。

1. 画像最適化
2. 遅延読み込み
3. aria属性
4. 見出し順序

## DoD
1. 3案ともゲート合格
2. 失敗理由を `quality-report` に記録
3. `quality_passed` へ遷移

