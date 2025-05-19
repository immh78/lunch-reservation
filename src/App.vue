<script setup>
import { database, ref as firebaseRef, get, update } from "./config/firebase";
import { ref, watch, onMounted } from "vue";

const chapters = ref([]);
//const chapters = ref(["Day 10", "Day 11"]);
const toggleMode = ref("quiz");
const toggleChapter = ref("");
const words = ref([]);
const selectWords = ref([]);
const wrongWords = ref([]);
const meaningWrongWord = ref("");
const wordFontSize = ref(70);
const isMeaningView = ref(false);
const isMeaningWrongWordView = ref(false);
const isSetPopup = ref(false);
const currentWord = ref({ "word": "Loaing..." });
const correctCount = ref(0);
const wrongCount = ref(0);
const progress = ref(0);
const totalCount = ref(0);
const currUser = ref("GW");
const preCorrectWord = ref({});
const preWrongWord = ref({});

/* DB 관련 변수 */
const quizChapters = ref(null);
const error = ref(null);

function selectingWord(param) {
    if (toggleMode.value == "quiz") {
        selectWords.value = words.value.filter(item => chapters.value.includes(item.chapter));
        toggleChapter.value = "";
    } else {
        selectWords.value = words.value.filter(item => item.chapter === param);
    }

    totalCount.value = selectWords.value.length;
}

function changeMode() {
    initValue();

    if (toggleMode.value == "quiz") {
        toggleChapter.value = "";
        selectingWord('');
        pickRandomWord();
    }
}

function changeChapter(param) {
    initValue();
    selectingWord(param);
    pickRandomWord();
}

function pickRandomWord() {
    if (selectWords.value.length === 0) {
        currentWord.value.wrongCount = 0;
        currentWord.value.word = "완료!";
        currentWord.value.meaning = "모든 단어를 외웠습니다.";
        return;
    }

    isMeaningView.value = false;

    let index = 0;
    if (toggleMode.value == "quiz") {
        index = Math.floor(Math.random() * selectWords.value.length);
    } else {
        index = 0;
    }
    currentWord.value = { ...selectWords.value[index] };
    setWordFondSize(currentWord.value.word);
}

function setWordFondSize(text) {

    //console.log(text);
    
    let tempFontSize = 70;

    if (text.length > 8) {
        tempFontSize -= (text.length - 7) * 10;
    }

    if (tempFontSize < 40) {
        wordFontSize.value = 40;
    } else {
        wordFontSize.value = tempFontSize;
    }
}

function markCorrect() {
    if (selectWords.value.length === 0) return;

    correctCount.value++;
    selectWords.value = selectWords.value.filter(item => item.word !== currentWord.value.word);

    if (currentWord.value.wrongCount > 0) {
        wrongWords.value = wrongWords.value.filter(item => item.word !== currentWord.value.word);
    }


    preCorrectWord.value = { ...currentWord.value };

    //console.log("#1", preCorrectWord.value);

    pickRandomWord();
    updateProgress();
}

function markWrong() {
    if (selectWords.value.length === 0) return;
    wrongCount.value++;

    if (toggleMode.value == "memorize") {
        const firstElement = selectWords.value.shift(); // Remove the first element
        firstElement.wrongCount += 1;
        selectWords.value.push(firstElement);
    } else {
        selectWords.value.find(item => item.word === currentWord.value.word).wrongCount += 1;
    }

    if (!wrongWords.value.some(item => item.word === currentWord.value.word)) {
        wrongWords.value.push(currentWord.value);
    }

    //console.log("#2", currentWord.value);
    preWrongWord.value = { ...currentWord.value };

    pickRandomWord();
}

function cancelCorrect() {
    //console.log("#3", preCorrectWord.value);
    if (Object.keys(preCorrectWord.value).length === 0) return;
    correctCount.value--;
    currentWord.value = { ...preCorrectWord.value };
    selectWords.value.push(preCorrectWord.value);
    preCorrectWord.value = {};
    setWordFondSize(currentWord.value.word);
    updateProgress();
}

function cancelWrong() {
    if (Object.keys(preWrongWord.value).length === 0) return;
    wrongCount.value--;
    currentWord.value = { ...preWrongWord.value };
    selectWords.value.push(preWrongWord.value);
    wrongWords.value = wrongWords.value.filter(item => item.word !== preWrongWord.value.word);
    preWrongWord.value = {};
    setWordFondSize(currentWord.value.word);
    updateProgress();
}

function updateProgress() {
    progress.value = Math.round(((totalCount.value - selectWords.value.length) / totalCount.value) * 100);
}

function speechWord() {
    const utterance = new SpeechSynthesisUtterance(currentWord.value.word);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
}

function initValue() {
    correctCount.value = 0;
    wrongCount.value = 0;
    currentWord.value.word = "";
    currentWord.value.meaning = "";
    currentWord.value.wrongCount = 0;
    progress.value = 0;
    isMeaningView.value = false;
    wrongWords.value = [];
    selectWords.value = [];
}

function showMeaningWrongWord(param) {
    meaningWrongWord.value = param;
    isMeaningWrongWordView.value = true;
}

async function fetchquizChapters() {
    const dbRef = firebaseRef(database, "eng-quiz-chapter");
    await get(dbRef)
        .then(snapshot => {
            if (snapshot.exists()) {
                quizChapters.value = snapshot.val();
            } else {
                console.log("No data available");
            }
        })
        .catch(err => {
            console.error("Error fetching data:", err);
            error.value = err.message;
        });
}

async function saveQuizChapter(data) {
    try {
        const dbRef = firebaseRef(database, "eng-quiz-chapter");
        await update(dbRef, data); // 데이터를 저장
        console.log("Data saved successfully!");
    } catch (err) {
        console.error("Error saving data:", err);
    }
}

async function getChapter(user) {
    await fetchquizChapters();

    console.log(user);

    if (quizChapters.value) {
        chapters.value = Object.values(quizChapters.value)
            .filter(item => item.select === true && item.user === user) // select가 true인 항목 필터링
            .map(item => item.chapter);
    }
}

// Watcher 설정
watch(chapters, (newValue, oldValue) => {

    const addedValues = newValue.filter(value => !oldValue.includes(value));
    const removedValues = oldValue.filter(value => !newValue.includes(value));

    let action = null;
    let chapter = "";
    let user = "";


    // 추가된 값과 삭제된 값에 따라 로직 실행
    if (addedValues.length > 0) {
        chapter = addedValues[0];
        action = true;
    }
    if (removedValues.length > 0) {
        action = false;
        chapter = removedValues[0];
    }


    if (action != null) {
        let idx = Object.values(quizChapters.value).findIndex(item => item.chapter === chapter && item.select != action);
        // 초기값과 비교하여 달라진것만 update
        if (idx > -1) {
            // 변경된 값에 따라 추가 로직 실행
            const data = { [idx]: { "chapter": chapter, "select": action, "user": currUser.value }};
            quizChapters.value[idx].select = action;
            saveQuizChapter(data);
            console.log("chapter update : ", quizChapters.value);
        }
    }


});

onMounted(async () => {
    await getChapter(currUser.value);

    await fetch('https://immh78.github.io/vite-project/words.json')
        .then(response => response.json())
        .then(data => {
            words.value = data.map(item => ({
                ...item,
                wrongCount: 0
            }));

        });

    selectingWord('');
    pickRandomWord();

})

</script>

<template>
    <v-app>
        <v-main>
            <v-app-bar color="teal-darken-4"> <!--image="https://picsum.photos/1920/1080?random-->
                <template v-slot:image>
                    <v-img gradient="to top right, rgba(19,84,122,.8), rgba(128,208,199,.8)"></v-img>
                </template>
                <template v-slot:append>
                    <v-btn icon="mdi-cog" @click="isSetPopup = true"></v-btn>
                </template>

                <v-app-bar-title><v-icon>mdi-book</v-icon> {{ currUser === "GW" ? "경원" : "채원" }}이 영어
                    단어장</v-app-bar-title>
            </v-app-bar>
            <v-container>
                <v-row justify="center">
                    <v-col cols="auto">
                        <v-btn-toggle v-model="toggleMode" variant="outlined" color="primary" mandatory>
                            <v-btn value="quiz" @click="changeMode()">
                                <span>퀴즈</span>
                                <v-icon end>mdi-chat-question</v-icon>
                            </v-btn>
                            <v-btn value="memorize" @click="changeMode()">
                                <span>암기</span>
                                <v-icon end>mdi-chat-alert</v-icon>
                            </v-btn>
                        </v-btn-toggle>
                    </v-col>
                </v-row>
                <v-row justify="center">
                    <v-col cols="auto">
                        <v-btn-toggle v-model="toggleChapter" color="deep-purple-accent-3" rounded="0" group
                            class="multi-line-btn-toggle">
                            <v-btn v-for="chapter in chapters" :key="chapter" :value="chapter"
                                :readonly="toggleMode == 'quiz' ? true : false"
                                :style="chapter == currentWord.chapter && toggleMode == 'quiz' ? 'text-decoration: underline' : ''"
                                @click="changeChapter(chapter)">
                                {{ chapter }}
                            </v-btn>

                        </v-btn-toggle>
                    </v-col>
                </v-row>
                <v-row id="wordRow">
                    <v-col cols="auto">
                        <span id="word" :style="{ fontSize: wordFontSize + 'px' }" @click="speechWord()">{{
                            currentWord.word
                            }}</span>
                        <span id="wrong">
                            <v-icon color="red-darken-4" v-for="n in currentWord.wrongCount">mdi-close-thick</v-icon>
                        </span>
                    </v-col>
                </v-row>
                <v-row id="meaningRow">
                    <v-col cols="auto">
                        <v-alert v-model="isMeaningView" color="success" height="40px">
                            {{ currentWord.meaning }}
                        </v-alert>
                    </v-col>
                </v-row>
                <v-row id="buttonRow">
                    <v-col cols="4">
                        <v-btn color="light-green-lighten-5" @click="isMeaningView = !isMeaningView" style="height: 50px;"><v-icon
                                color="green">mdi-magnify</v-icon>뜯보기</v-btn>
                    </v-col>
                    <v-col cols="4" class="no-wrap">
                        <v-badge color="blue" :content="correctCount"><v-btn color="blue-lighten-5"
                                @click="markCorrect()" style="height: 50px;"><v-icon color="blue">mdi-check-bold</v-icon>정답</v-btn></v-badge>
                        <v-btn :color="Object.keys(preCorrectWord).length === 0 ? 'gray' : 'blue'" icon="mdi-undo"
                            variant="text" size="24px" @click="cancelCorrect()"></v-btn>
                    </v-col>
                    <v-col cols="4" class="no-wrap">
                        <v-badge color="error" :content="wrongCount"><v-btn color="red-lighten-5"
                                @click="markWrong()" style="height: 50px;"><v-icon color="red">mdi-close-thick</v-icon>오답</v-btn></v-badge>
                        <v-btn :color="Object.keys(preWrongWord).length === 0 ? 'gray' : 'red'" icon="mdi-undo"
                            variant="text" size="24px" @click="cancelWrong()"></v-btn>
                    </v-col>
                </v-row>
                <v-sheet v-if="wrongWords.length > 0" id="wrongWordRow" class="pa-4 mx-auto"
                    rounded="lg" width="92%" color="#fff2f4">
                    <v-row>
                        <v-col cols="auto">

                            <v-chip v-for="wrongWord in wrongWords" color="red" text-color="white" class="chip-spacing"
                                @click="showMeaningWrongWord(wrongWord.meaning)">
                                {{ wrongWord.word }}
                            </v-chip>
                        </v-col>
                    </v-row>
                </v-sheet>
            </v-container>
            <v-snackbar v-model="isMeaningWrongWordView" :timeout="2000" color="success" variant="tonal">
                {{ meaningWrongWord }}
            </v-snackbar>
            <v-dialog v-model="isSetPopup" max-width="500">
                <v-card title="학습 단원 선택">
                    <v-container>
                        <v-row>
                            <v-col v-for="(c, index) in quizChapters.filter(item => item.user === currUser)"
                                :key="index" cols="6">
                                <v-switch v-model="chapters" color="red" :label="c.chapter" :value="c.chapter"
                                    hide-details></v-switch>
                            </v-col>
                        </v-row>
                    </v-container>
                </v-card>
                <v-fab icon="mdi-close" color="blue" @click="isSetPopup = false" class="fixed-fab">
                </v-fab>
            </v-dialog>
        </v-main>

        <v-progress-linear :model-value="progress" color="green"></v-progress-linear>

    </v-app>

</template>

<style scoped>
#wrong {
    font-size: 8px;
}

#wordRow {
    position: absolute;
    top: 180px;
    justify-content: center;
    display: flex;
    width: 100%;
}

#buttonRow {
    position: absolute;
    top: 340px;
    justify-content: center;
    display: flex;
    width: 100%;
}

#meaningRow {
    position: absolute;
    top: 280px;
    justify-content: center;
    display: flex;
    width: 100%;
}

#wrongWordRow {
    position: absolute;
    justify-content: center;
    top: 430px;
}


.multi-line-btn-toggle {
    display: flex;
    flex-wrap: wrap;
    /* 버튼이 여러 줄로 배치되도록 설정 */
    justify-content: center;
    /* 버튼을 중앙 정렬 */
    width: 100%;
    /* 버튼 토글의 너비를 100%로 설정 */
}

.chip-spacing {
    margin: 4px;
    /* 각 v-chip 간격 설정 */
}

.fixed-fab {
    position: fixed;
    top: 16px;
    /* 화면 하단에서 16px 위 */
    right: 16px;
    /* 화면 우측에서 16px 왼쪽 */
    z-index: 1050;
    /* 다른 요소 위에 표시되도록 설정 */
}

.no-wrap {
    display: flex;
    flex-wrap: nowrap;
}
</style>
