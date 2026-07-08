import { GoogleGenerativeAI } from "@google/generative-ai";

// Constants
const BRIDGE_URL = window.location.origin;

// UI Elements
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const fetchDataBtn = document.getElementById('fetch-data-btn');
const pbiStatus = document.getElementById('pbi-status');
const geminiKeyInput = document.getElementById('gemini-key');
const pillContainer = document.getElementById('data-pill-container');

// Modal Elements
const selectionModal = document.getElementById('selection-modal');
const closeModalBtn = document.getElementById('close-modal');
const modalListContainer = document.getElementById('modal-list-container');
const modalSearchInput = document.getElementById('modal-search-input');
const modalSelectionCount = document.getElementById('modal-selection-count');
const confirmSelectionBtn = document.getElementById('confirm-selection');
const selectionCount = document.getElementById('selection-count');

// State
let allColumns = [];
let selectedColumns = [];
let schemaMap = {};
let config = {};
let genAI, model;

async function initialize() {
    try {
        console.log("Initializing app...");
        
        const response = await fetch('schema_map.json');
        if (!response.ok) throw new Error('schema_map.json 로드 실패');
        config = await response.json();
        
        schemaMap = {
            tables: config.tables,
            persona: config.persona
        };

        // Load columns
        await loadColumns();
        
        // Initial render
        updateSelectedPills();
        
        const healthCheck = await fetch(`${BRIDGE_URL}/health`).catch(() => null);
        
        if (healthCheck && healthCheck.ok) {
            pbiStatus.textContent = "Connected (대교협 기관평가인증)";
            pbiStatus.classList.replace('disconnected', 'connected');
        } else {
            pbiStatus.textContent = "Bridge Offline";
            pbiStatus.classList.replace('connected', 'disconnected');
        }

        // 보안을 위해 브라우저 종료 시 삭제되는 sessionStorage 사용
        const savedKey = sessionStorage.getItem('gemini_api_key');
        if (savedKey) {
            geminiKeyInput.value = savedKey;
        }

        const apiKey = geminiKeyInput.value.trim();
        if (apiKey) {
            genAI = new GoogleGenerativeAI(apiKey);
            model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
            userInput.disabled = false;
            sendBtn.disabled = false;
        } else {
            addMessage('system', '사용을 위해 상단에 **Gemini API 키**를 입력해주세요.');
            userInput.disabled = true;
            sendBtn.disabled = true;
        }

        userInput.addEventListener('focus', () => {
            if (selectedColumns.length === 0) openModal();
        });

        pillContainer.addEventListener('click', (e) => {
            if (selectedColumns.length === 0 || e.target.closest('.placeholder-text')) openModal();
        });

        console.log("App initialized successfully");
    } catch (error) {
        console.error("Initialization error:", error);
        addMessage('system', '초기화 오류: ' + error.message);
    }
}

async function loadColumns() {
    // Use the filtered columns from schema_map.json (already loaded in initialize as 'config')
    if (config && config.tables && config.tables[0].columns) {
        // We only want the names of the indicators for the selection list
        allColumns = config.tables[0].columns.map(col => col.name);
        console.log("Columns loaded from schema_map.json config (filtered)");
    } else {
        console.error("No columns found in schema_map.json config");
        addMessage('system', '지표 정보를 불러올 수 없습니다. schema_map.json을 확인해주세요.');
    }
}

function openModal() {
    selectionModal.classList.add('active');
    renderModalList();
    modalSearchInput.focus();
}

closeModalBtn.addEventListener('click', () => selectionModal.classList.remove('active'));
confirmSelectionBtn.addEventListener('click', () => {
    selectionModal.classList.remove('active');
    updateSelectedPills();
});

selectionModal.addEventListener('click', (e) => {
    if (e.target === selectionModal) selectionModal.classList.remove('active');
});

function renderModalList(filter = '') {
    modalListContainer.innerHTML = '';
    const filtered = allColumns.filter(col => 
        col.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        modalListContainer.innerHTML = '<div class="loading-text">검색 결과가 없습니다.</div>';
        return;
    }

    const tableName = schemaMap.tables[0].name;
    filtered.forEach(col => {
        const item = document.createElement('div');
        item.classList.add('modal-item');
        if (selectedColumns.includes(col)) item.classList.add('selected');

        const checkbox = document.createElement('div');
        checkbox.classList.add('checkbox');
        
        const span = document.createElement('span');
        span.textContent = col.replace(`${tableName}[`, '').replace(']', '');

        item.appendChild(checkbox);
        item.appendChild(span);
        item.addEventListener('click', () => toggleSelection(col, item));
        
        modalListContainer.appendChild(item);
    });
}

modalSearchInput.addEventListener('input', (e) => renderModalList(e.target.value));

function toggleSelection(col, element) {
    const index = selectedColumns.indexOf(col);
    if (index > -1) {
        selectedColumns.splice(index, 1);
        element.classList.remove('selected');
    } else {
        if (selectedColumns.length >= 5) {
            alert('최대 5개까지 선택할 수 있습니다.');
            return;
        }
        selectedColumns.push(col);
        element.classList.add('selected');
    }
    modalSelectionCount.textContent = `${selectedColumns.length} / 5 선택됨`;
    selectionCount.textContent = `${selectedColumns.length} / 5`;
}

function updateSelectedPills() {
    pillContainer.innerHTML = '';
    const tableName = schemaMap.tables[0].name;

    if (selectedColumns.length === 0) {
        pillContainer.innerHTML = '<div class="placeholder-text">질문 입력창을 클릭하여 지표를 선택하세요.</div>';
    } else {
        const editBtn = document.createElement('div');
        editBtn.classList.add('edit-metrics-btn');
        editBtn.innerHTML = '<i data-lucide="settings-2"></i> 지표 수정';
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal();
        });
        pillContainer.appendChild(editBtn);

        selectedColumns.forEach(col => {
            const pill = document.createElement('div');
            pill.classList.add('data-pill');
            
            const nameSpan = document.createElement('span');
            nameSpan.textContent = col.replace(`${tableName}[`, '').replace(']', '');
            
            const removeBtn = document.createElement('span');
            removeBtn.innerHTML = '<i data-lucide="x"></i>';
            removeBtn.classList.add('remove-btn');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedColumns = selectedColumns.filter(c => c !== col);
                updateSelectedPills();
                selectionCount.textContent = `${selectedColumns.length} / 5`;
            });

            pill.appendChild(nameSpan);
            pill.appendChild(removeBtn);
            pillContainer.appendChild(pill);
        });
    }
    lucide.createIcons();
}

function addMessage(type, text) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', type);
    
    if (type === 'ai' || type === 'system') {
        msgDiv.innerHTML = typeof marked !== 'undefined' ? marked.parse(text) : text;
    } else {
        msgDiv.textContent = text;
    }
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return msgDiv;
}

function createLoadingIndicator() {
    const container = document.createElement('div');
    container.classList.add('loading-status-container');
    
    container.innerHTML = `
        <div class="status-main">
            <div class="spinner-small"></div>
            <span class="status-text">분석 준비 중...</span>
        </div>
        <div class="progress-stepper">
            <div class="progress-fill" style="width: 10%;"></div>
        </div>
        <div class="status-sub">잠시만 기다려 주세요...</div>
        <div class="analysis-timer">
            <i data-lucide="clock" style="width:14px;height:14px;"></i>
            <span class="timer-value">0.0s</span>
        </div>
    `;
    
    const msgDiv = addMessage('ai', '');
    msgDiv.innerHTML = '';
    msgDiv.appendChild(container);
    lucide.createIcons();
    
    const statusText = container.querySelector('.status-text');
    const statusSub = container.querySelector('.status-sub');
    const progressFill = container.querySelector('.progress-fill');
    const timerValue = container.querySelector('.timer-value');
    
    let startTime = Date.now();
    let timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        timerValue.textContent = `${elapsed}s`;
    }, 100);
    
    const subMessages = [
        "데이터를 꼼꼼히 살피고 있어요...",
        "복잡한 수식을 계산 중입니다...",
        "가장 정확한 답변을 찾고 있어요...",
        "거의 다 되었습니다. 조금만 더요!",
        "분석 결과를 정리하고 있습니다..."
    ];
    
    let subMsgIndex = 0;
    let subMsgInterval = setInterval(() => {
        statusSub.textContent = subMessages[subMsgIndex % subMessages.length];
        subMsgIndex++;
    }, 3000);
    
    return {
        update: (main, progress) => {
            if (main) statusText.textContent = main;
            if (progress) progressFill.style.width = `${progress}%`;
        },
        stop: () => {
            clearInterval(timerInterval);
            clearInterval(subMsgInterval);
        },
        element: msgDiv
    };
}

async function processWorkflow(question) {
    const loader = createLoadingIndicator();
    const tableName = schemaMap.tables[0].name;
    
    try {
        loader.update('질문 분석 및 DAX 생성 중...', 25);
        
        const escapedSelected = selectedColumns.map(col => {
            const colName = col.replace(`${tableName}[`, '').replace(']', '');
            const escapedColName = colName.replace(/\]/g, ']]');
            return `'${tableName}'[${escapedColName}]`;
        });

        const selectedContext = escapedSelected.length > 0 
            ? `\n[User Selected Measures/Columns (CRITICAL)]\n${escapedSelected.join('\n')}\n(The user is explicitly asking about THESE metrics. '위 지표' refers to THESE metrics.)`
            : '';

        const daxPrompt = `
You are a Power BI DAX expert. Generate a DAX query based on the user's question, schema, and specific persona instructions.

[Schema Info]
${JSON.stringify(schemaMap)}
${selectedContext}

[Expert Persona & Instructions]
Role: ${schemaMap.persona.role}
Instructions:
${schemaMap.persona.instructions.join('\n')}

[CRITICAL DAX RULES]
1. Return ONLY the code block starting with "DEFINE". No conversational text.
2. Use EXACT dax_name from Schema Info for columns.
3. For 'Recent 3 Years', follow Instruction 5 (TOPN or Max Year filter).
4. For 'National Average/Rank', follow Instruction 6, 7, and 8.

User Question: "${question}"`;

        const daxResult = await model.generateContent(daxPrompt);
        let rawDax = daxResult.response.text().trim();
        let daxQuery = rawDax.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim();
        
        const defineIndex = daxQuery.toUpperCase().indexOf('DEFINE');
        if (defineIndex !== -1) daxQuery = daxQuery.substring(defineIndex);

        console.log("DAX Query:", daxQuery);

        loader.update('Power BI 데이터 수집 중...', 60);
        
        const pbiResponse = await fetch(`${BRIDGE_URL}/execute-dax`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                query: daxQuery,
                datasetId: config.datasetId
            })
        });

        const pbiData = await pbiResponse.json();
        if (!pbiData.success) throw new Error(pbiData.message + (pbiData.details ? `\n${pbiData.details}` : ''));

        const rows = pbiData.data.results[0].tables[0].rows;
        if (!rows || rows.length === 0) throw new Error("조회된 결과가 없습니다.");
        
        loader.update('인사이트 분석 및 보고서 작성 중...', 85);
        
        const analysisPrompt = `
            [Question]
            "${question}"

            [Context Data]
            ${JSON.stringify(rows.slice(0, 50))}

            [Selected Indicators]
            ${selectedColumns.map(c => `- ${c.replace(`${tableName}[`, '').replace(']', '')}`).join('\n')}

            [System Configuration]
            Role: ${schemaMap.persona.role}
            Reporting Instructions:
            ${schemaMap.persona.instructions.join('\n')}

            Generate a professional, insight-driven report in Korean.
        `;

        const finalResult = await model.generateContentStream(analysisPrompt);
            
        loader.stop();
        let accumulatedText = '';
        for await (const chunk of finalResult.stream) {
            const chunkText = chunk.text();
            accumulatedText += chunkText;
            loader.element.innerHTML = typeof marked !== 'undefined' ? marked.parse(accumulatedText) : accumulatedText;
        }

    } catch (error) {
        loader.stop();
        console.error(error);
        loader.element.innerHTML = '❌ 오류: ' + error.message;
    }
}

sendBtn.addEventListener('click', async () => {
    const text = userInput.value.trim();
    if (!text) return;
    addMessage('user', text);
    userInput.value = '';
    await processWorkflow(text);
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
});

fetchDataBtn.addEventListener('click', initialize);

geminiKeyInput.addEventListener('change', () => {
    const newKey = geminiKeyInput.value.trim();
    if (newKey) {
        sessionStorage.setItem('gemini_api_key', newKey);
        addMessage('system', 'Gemini API 키가 임시 저장되었습니다. (브라우저 종료 시 삭제됨)');
        initialize();
    } else {
        // 키를 지웠을 때 동작 정지 및 키 삭제
        sessionStorage.removeItem('gemini_api_key');
        genAI = null;
        model = null;
        userInput.disabled = true;
        sendBtn.disabled = true;
        addMessage('system', 'API 키가 삭제되었습니다. 다시 사용하려면 키를 입력해주세요.');
    }
});

initialize();
