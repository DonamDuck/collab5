@AGENTS.md

## 작업 방식·제약 (모든 세션 공통)
새 세션은 **`docs/세션-온보딩.md`를 읽고** 그 작업방식·커밋규율·제약·병렬세션(worktree) 셋업을 따른다. (커밋은 만진 파일만 `git add`, 배포=`git push`, tsc+build 통과 후, API키 대신입력 금지 등)

## Brain (Obsidian Vault — PARA)
세션 시작 시 반드시 먼저 실행:
```
Read /Users/youngduck/Desktop/collab5-Obsidian/INDEX.md
```

INDEX 확인 후:
- `📢 알림` → FYI 숙지 (액션 불필요)
- `⚠️ 미읽 멘션` → 해당 노트 로드 후 처리

### Vault 구조 (PARA)
| 폴더 | 용도 | 예시 |
|---|---|---|
| `1_Projects/` | 지금 끝낼 것 (완료조건 있음) | 브랜드-소개서, 위저드-모바일-QA |
| `2_Areas/` | 꾸준히 유지하는 기준 | 디자인-시스템, 의사결정-로그, 인프라-운영 |
| `3_Resources/` | 언젠가 쓸 참고 | PARA-운영법, API 문서 |
| `4_Archive/` | 완료되어 치운 것 | 완료-마일스톤 |

### 저장 규칙
- 새 작업 → `1_Projects/` 노트 (완료조건 명시)
- 결정·정책·왜 이렇게 했나 → `2_Areas/의사결정-로그`
- 디자인 스펙 변경 → `2_Areas/디자인-시스템`
- 작업 완료 → `4_Archive/`로 이동 + INDEX 내림

### 팀 커뮤니케이션
- **hook** ("~팀에 알려줘") → INDEX `📢 알림`에 FYI 추가
- **mention** ("~팀에 멘션/요청") → 대상 노트 `⚠️ 미읽 멘션`에 체크박스 추가 + INDEX 업데이트

Vault 경로: `/Users/youngduck/Desktop/collab5-Obsidian/`
