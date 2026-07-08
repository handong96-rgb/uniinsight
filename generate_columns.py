import json

# schema_map.json에서 컬럼 정보를 읽어옵니다.
with open('schema_map.json', 'r', encoding='utf-8') as f:
    schema = json.load(f)

table_name = schema['tables'][0]['name']
columns = []

for col in schema['tables'][0]['columns']:
    columns.append(f"{table_name}[{col['name']}]")

# actual_columns.json으로 저장합니다.
with open('actual_columns.json', 'w', encoding='utf-8') as f:
    json.dump(columns, f, ensure_ascii=False, indent=4)

print(f"Success: Generated actual_columns.json with {len(columns)} columns.")
