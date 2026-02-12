# Claude Project Setup

## 目的
Claudeプロジェクト起動時に、実装の迷いを減らす最低構成を固定する。

## プロジェクト内で持つもの

1. `.claude/commands/`
- 毎回使う起動コマンド

2. `.claude/skills/`
- このプロジェクト固有の手順を閉じ込める
- 例: HP特定、content lock検査、品質ゲート修正

3. `docs/phases/`
- スキルが参照する仕様の正本

## スキル運用方針

1. 1スキル1責務にする
2. SKILL本文は短くし、詳細は `references/` へ逃がす
3. スキルの入出力は必ず `schemas/` を参照
4. 変更時はSKILLと参照資料の両方を更新

## 初期セット（このリポジトリに作成済み）

- `.claude/skills/hp-workflow-orchestrator/SKILL.md`
- `.claude/skills/hp-workflow-orchestrator/references/phase-checklists.md`
- `.claude/commands/hp-workflow-kickoff.md`

## 実行ルール（推奨）

1. まず `hp-workflow-kickoff` で現在フェーズを確認
2. 対応フェーズのチェックリストに沿って作業
3. 生成物はスキーマ検証してから次工程へ

