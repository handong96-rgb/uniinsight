import json

# 기존에 수동으로 작성되었던 중요한 메타데이터 (복구용)
old_metadata = {
    "전임교원 확보율(%)": {
        "aliases": ["전임교원 확보율", "교원확보율", "전임교원확보율"],
        "description": "가장 안정적인 전임교원 확보율 데이터(권장)"
    },
    "신입생 충원율(%)": {
        "aliases": ["신입생충원율", "충원율"]
    },
    "재학생 충원율(%)": {
        "aliases": ["재학생충원율"]
    },
    "[3.1] 전임교원 및 겸임교원 확보율": {
        "aliases": ["공식교원확보율"],
        "description": "인증 지표용 공식 명칭 (괄호 포함)"
    },
    "[1.5] 졸업생 진로 성과": {
        "aliases": ["취업률", "졸업생진로성과"]
    },
    "[1.3] 세입 중 기부금 비율": {
        "aliases": ["기부금비율", "기부금 비율"],
        "description": "대학 총 세입 중 기부금이 차지하는 비율. 대학의 대외 평판 및 재정 건전성을 나타내는 지표."
    },
    "학교명": {
        "description": "대학의 정식 명칭"
    },
    "지역": {
        "description": "대학 소재 지역"
    },
    "통계연도": {
        "description": "형식: '2023년도'"
    },
    "연도": {
        "description": "형식: 2023"
    }
}

# 새로 추가된 지표들에 대한 추가 메타데이터 보강
additional_metadata = {
    "[3.4] 전임교원 1인당 SCI급 논문 실적": {
        "aliases": ["SCI논문실적", "논문실적"],
        "description": "전임교원 1인당 국제 저명 학술지(SCI급) 게재 논문 수"
    },
    "[4.1] 장학금 비율": {
        "aliases": ["장학금비율"],
        "description": "총 교육비 대비 학생들에게 지급된 장학금의 비율"
    },
    "[1.3] 교육비 환원율": {
        "aliases": ["교육비환원율"],
        "description": "학생들이 납부한 등록금 대비 대학이 학생 교육을 위해 투자한 비용의 비율"
    },
    "[4.5] 기숙사 수용률 I": {
        "aliases": ["기숙사수용률"],
        "description": "재학생 대비 기숙사 수용 가능 인원 비율"
    }
}

with open('schema_map.json', 'r', encoding='utf-8') as f:
    schema = json.load(f)

# 메타데이터 병합
for table in schema['tables']:
    for col in table['columns']:
        name = col['name']
        # 1. 기존 메타데이터 복구
        if name in old_metadata:
            col.update(old_metadata[name])
        # 2. 새로운 중요 지표 메타데이터 보강
        elif name in additional_metadata:
            col.update(additional_metadata[name])

with open('schema_map.json', 'w', encoding='utf-8') as f:
    json.dump(schema, f, ensure_ascii=False, indent=4)

print("Success: Restored old metadata and enhanced new indicators in schema_map.json")
