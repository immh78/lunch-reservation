<script setup>
import { ref } from 'vue';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useRouter } from 'vue-router';
import { database, ref as firebaseRef, update } from "../config/firebase";

const email = ref('');
const password = ref('');
const name = ref('');
const showPassword = ref(false);
const loading = ref(false);
const errorMessage = ref('');
const router = useRouter();

const register = async () => {
    try {
        loading.value = true;
        errorMessage.value = '';

        const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value);
        const user = userCredential.user;

        saveUser();
        alert(`환영합니다, ${user.email} 님!`);
        router.push('/login');
    } catch (error) {
        console.error(error.code, error.message);
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage.value = '이미 등록된 이메일입니다.';
                break;
            case 'auth/invalid-email':
                errorMessage.value = '유효하지 않은 이메일입니다.';
                break;
            case 'auth/weak-password':
                errorMessage.value = '비밀번호는 6자 이상이어야 합니다.';
                break;
            default:
                errorMessage.value = '회원가입에 실패했습니다.';
        }
    } finally {
        loading.value = false;
    }
};


async function saveUser() {
    const data = {
        [auth.currentUser.uid]: {
            name: name.value,
            email: email.value
        }
    };

    const dbRef = firebaseRef(database, 'user');
    await update(dbRef, data)
        .then(() => {
            console.log("User data saved successfully.");
        })
        .catch((error) => {
            console.error("Error saving user data:", error);
        });
}
</script>

<template>
    <v-container class="d-flex align-center justify-center fill-height">
        <v-card width="400" class="pa-6">
            <v-card-title class="text-h5 text-center">회원가입</v-card-title>

            <v-form @submit.prevent="register">
                <v-text-field v-model="name" label="이름" prepend-inner-icon="mdi-account" type="text" required />

                <v-text-field v-model="email" label="Email" prepend-inner-icon="mdi-email" type="email" required />

                <v-text-field v-model="password" label="Password" prepend-inner-icon="mdi-lock"
                    :type="showPassword ? 'text' : 'password'" :append-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                    @click:append="showPassword = !showPassword" required />

                <v-btn :loading="loading" color="primary" class="mt-4" type="submit" block>
                    회원가입
                </v-btn>
            </v-form>

            <v-alert v-if="errorMessage" type="error" class="mt-4" dense>
                {{ errorMessage }}
            </v-alert>
        </v-card>
    </v-container>
</template>

<style scoped>
.fill-height {
    min-height: 100vh;
}
</style>
