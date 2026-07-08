import requests
import json

def get_actual_schema():
    url = "http://localhost:5000/execute-dax"
    # 테이블의 상위 1개 행만 가져와서 컬럼 구조를 파악합니다.
    dax = "EVALUATE TOPN(1, '대교협기관평가인증 통계')"
    
    payload = {"query": dax}
    response = requests.post(url, json=payload)
    
    if response.status_code == 200:
        res_data = response.json()
        if res_data.get("success"):
            tables = res_data["data"]["results"][0]["tables"]
            if tables:
                columns = list(tables[0]["rows"][0].keys())
                # 'Table[Column]' 형식에서 'Column'만 추출하거나 전체 리스트 저장
                with open('actual_schema.json', 'w', encoding='utf-8') as f:
                    json.dump(columns, f, ensure_ascii=False, indent=4)
                print("성공: actual_schema.json 파일에 전체 컬럼 리스트를 저장했습니다.")
                return columns
        else:
            print("쿼리 실행 실패:", res_data.get("message"))
            print("상세:", res_data.get("details"))
    else:
        print("API 호출 실패:", response.status_code, response.text)
    return None

if __name__ == "__main__":
    get_actual_schema()
