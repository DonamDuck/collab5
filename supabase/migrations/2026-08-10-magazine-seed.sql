-- 매거진 렌더 확인용 **더미 1건** (2026-08-10) — 선택 실행
--
-- ⚠️ 이건 창간호가 아니다. 렌더러가 노드 8종을 제대로 그리는지 눈으로 보려고 넣는 표본이다.
--    창간호 본문은 **에디터로 입력**한다(지시서 §8 "1호 본문을 코드에 하드코딩 금지").
--    확인이 끝나면 지워도 된다:  delete from magazine_articles where slug = 'render-test';
--
-- 이 한 건에 본문 노드가 전부 한 번씩 들어 있다 —
--   문단 / 소제목(h3) / 굵게·기울임 / 인용문 / 강조박스(pullQuote) /
--   순서없는 목록 / 순서있는 목록 / 구분선 / 이미지+캡션 / 링크
-- 하나라도 안 그려지면 그 자리에서 티가 난다.

insert into magazine_articles (
  slug, status, title, subtitle, editor_name, location,
  cover_image, summary, fact_box, brand_links, body, published_at
) values (
  'render-test',
  'published',
  '렌더 확인용 표본 글이에요',
  '표본 브랜드 × 표본 브랜드 · 렌더 테스트',
  '안톤',
  '고양 일산동구',
  '',
  '본문 렌더러가 노드를 제대로 그리는지 확인하려고 넣어둔 표본이에요. 확인이 끝나면 지워주세요.',
  '[{"label":"함께한 곳","value":"표본 브랜드 A × 표본 브랜드 B"},
    {"label":"언제","value":"2026년 8월 10일"},
    {"label":"무엇을","value":"렌더 확인 1시간"}]'::jsonb,
  '[]'::jsonb,
  '{
    "type": "doc",
    "content": [
      {"type":"paragraph","content":[
        {"type":"text","text":"이건 평범한 문단이에요. 이 문장 안에 "},
        {"type":"text","marks":[{"type":"bold"}],"text":"굵게"},
        {"type":"text","text":"와 "},
        {"type":"text","marks":[{"type":"italic"}],"text":"기울임"},
        {"type":"text","text":", 그리고 "},
        {"type":"text","marks":[{"type":"link","attrs":{"href":"https://collab5.co.kr"}}],"text":"링크"},
        {"type":"text","text":"가 섞여 있습니다."}
      ]},
      {"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":"소제목은 이렇게 보여요"}]},
      {"type":"paragraph","content":[{"type":"text","text":"소제목 아래 문단입니다. 줄바꿈과 여백이 자연스러운지 봐주세요."}]},
      {"type":"blockquote","content":[
        {"type":"paragraph","content":[{"type":"text","text":"인용문이에요. 현장 발화나 모집글 원문을 옮길 때 씁니다."}]}
      ]},
      {"type":"pullQuote","content":[{"type":"text","text":"강조 박스입니다. 본문 중간에 한 번 크게 띄우고 싶을 때."}]},
      {"type":"bulletList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"순서 없는 목록 첫째"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"순서 없는 목록 둘째"}]}]}
      ]},
      {"type":"orderedList","content":[
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"순서 있는 목록 첫째"}]}]},
        {"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"순서 있는 목록 둘째"}]}]}
      ]},
      {"type":"horizontalRule"},
      {"type":"image","attrs":{
        "src":"https://images.unsplash.com/photo-1518843875459-f738682238a6?w=1200",
        "alt":"표본 이미지",
        "caption":"사진 아래 캡션이 이렇게 붙습니다."
      }},
      {"type":"paragraph","content":[{"type":"text","text":"마지막 문단이에요. 여기까지 다 보이면 렌더러는 정상입니다."}]}
    ]
  }'::jsonb,
  now()
)
on conflict (slug) do nothing;
