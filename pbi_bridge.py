from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import json
import os
from datetime import datetime
from msal import ConfidentialClientApplication
from dotenv import load_dotenv

load_dotenv() # .env 파일에서 환경 변수 불러오기

app = Flask(__name__, static_folder='.')
CORS(app)  # 브라우저에서의 접근 허용

# --- [설정 정보] ---
# 보안을 위해 환경 변수에서 값을 가져옵니다. (.env 파일)
CLIENT_ID = os.environ.get('CLIENT_ID')
CLIENT_SECRET = os.environ.get('CLIENT_SECRET')
TENANT_ID = os.environ.get('TENANT_ID')
GROUP_ID = os.environ.get('GROUP_ID')
DATASET_ID = os.environ.get('DATASET_ID')

AUTHORITY = f"https://login.microsoftonline.com/{TENANT_ID}"
SCOPES = ["https://analysis.windows.net/powerbi/api/.default"]

def get_access_token():
    client_app = ConfidentialClientApplication(CLIENT_ID, authority=AUTHORITY, client_credential=CLIENT_SECRET)
    result = client_app.acquire_token_for_client(scopes=SCOPES)
    if "access_token" in result:
        return result['access_token']
    else:
        raise Exception(f"토큰 발급 실패: {result.get('error_description')}")

@app.route('/execute-dax', methods=['POST'])
def execute_dax():
    try:
        req_data = request.json
        dax_query_str = req_data.get('query')
        target_dataset_id = req_data.get('datasetId', DATASET_ID) # 전달받은 ID가 없으면 기본값 사용
        
        if not dax_query_str:
            return jsonify({"success": False, "message": "DAX 쿼리가 제공되지 않았습니다."}), 400

        print(f">>> [DEBUG] 토큰 발급 시도 중...")
        token = get_access_token()
        print(f">>> [DEBUG] 토큰 발급 성공")

        print(f">>> [DEBUG] 로그 파일 기록 시도 중...")
        try:
            with open('query_log.txt', 'a', encoding='utf-8') as f:
                f.write(f"\n--- [{datetime.now()}] [{target_dataset_id}] ---\n{dax_query_str}\n-----------------------------\n")
            print(f">>> [DEBUG] 로그 파일 기록 성공")
        except Exception as log_e:
            print(f">>> [DEBUG] 로그 파일 기록 실패: {log_e}")

        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        query_url = f"https://api.powerbi.com/v1.0/myorg/groups/{GROUP_ID}/datasets/{target_dataset_id}/executeQueries"
        
        payload = {
            "queries": [{"query": dax_query_str}],
            "serializerSettings": {"includeNulls": True}
        }
        
        print(f">>> [DEBUG] Power BI API 호출 시도 중 (Dataset: {target_dataset_id})...")
        response = requests.post(query_url, headers=headers, data=json.dumps(payload))
        print(f">>> [DEBUG] Power BI API 응답 수신: {response.status_code}")
        
        if response.status_code == 200:
            return jsonify({"success": True, "data": response.json()})
        else:
            print(f"Power BI API Error ({response.status_code}): {response.text}")
            return jsonify({
                "success": False, 
                "message": f"Power BI API 오류: {response.status_code}",
                "details": response.text
            }), 400

    except Exception as e:
        print(f">>> [ERROR] execute_dax 내부 오류 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/get-columns', methods=['POST'])
def get_columns():
    try:
        req_data = request.json
        target_dataset_id = req_data.get('datasetId', DATASET_ID)
        
        token = get_access_token()
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
        
        query_url = f"https://api.powerbi.com/v1.0/myorg/groups/{GROUP_ID}/datasets/{target_dataset_id}/executeQueries"
        
        # DMS (Data Mining Schema)를 사용하여 컬럼 정보를 가져옵니다.
        # 대부분의 Power BI 데이터셋에서 작동하는 쿼리입니다.
        dax_query = "EVALUATE SELECTCOLUMNS(FILTER(INFO.COLUMNS(), [IS_HIDDEN] = FALSE()), \"Table\", [TABLE_NAME], \"Column\", [COLUMN_NAME])"
        
        payload = {
            "queries": [{"query": dax_query}],
            "serializerSettings": {"includeNulls": True}
        }
        
        response = requests.post(query_url, headers=headers, data=json.dumps(payload))
        
        if response.status_code == 200:
            res_data = response.json()
            rows = res_data['results'][0]['tables'][0]['rows']
            # 'Table[Column]' 형식으로 변환
            columns = [f"{row['Table']}[{row['Column']}]" for row in rows]
            return jsonify({"success": True, "columns": columns})
        else:
            return jsonify({"success": False, "message": f"Power BI API 오류: {response.status_code}", "details": response.text}), 400
            
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy", "message": "Power BI Bridge Server is running."})

STATIC_DIR = os.path.dirname(os.path.abspath(__file__))
print(f"Static files will be served from: {STATIC_DIR}")

@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')

@app.route('/<path:path>')
def static_proxy(path):
    print(f"Serving file: {path} from {STATIC_DIR}")
    return send_from_directory(STATIC_DIR, path)

if __name__ == '__main__':
    # 로컬 테스트용 5000 포트 실행
    app.run(port=5000, debug=True)
