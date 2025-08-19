<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { database, ref as firebaseRef, set, update } from "../config/firebase"

// Cloudinary
import { Cloudinary } from '@cloudinary/url-gen'
import { AdvancedImage, responsive, placeholder } from '@cloudinary/vue'

/**
 * Props
 */
const props = defineProps({
  /** v-model for the dialog open state */
  modelValue: { type: Boolean, default: false },
  /** When true, create mode; otherwise edit mode */
  isAdd: { type: Boolean, default: false },
  /** Restaurant info object { id?, name, kind, telNo, menuUrl?, menuImgId? } */
  restaurantInfo: { type: Object, default: () => ({}) },
  /** Mapping label->icon name (same as in parent) */
  restaurantKind: { type: Object, default: () => ({}) },
  /** Array of blocked restaurant IDs for this user */
  blockList: { type: Array, default: () => [] },
  /** Required to save to per-user block path */
  uid: { type: String, required: true },
  /** Cloudinary config */
  cloudName: { type: String, required: true },
  uploadPreset: { type: String, required: true }
})

/**
 * Emits
 */
const emit = defineEmits([
  'update:modelValue', // when dialog open state changes
  'saved',             // after saving restaurant
  'block-changed',     // after toggling block (emits current list)
  'closed',             // when clicking X
  'preview' 
])

// ----- Local state -----
const local = ref({ id: '', name: '', kind: '', telNo: '', menuUrl: '', menuImgId: '' })
const isOpen = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

watch(() => props.restaurantInfo, (v) => {
  // clone shallow to avoid mutating parent before save
  local.value = {
    id: v?.id || '',
    name: v?.name || '',
    kind: v?.kind || '',
    telNo: v?.telNo || '',
    menuUrl: v?.menuUrl || '',
    menuImgId: v?.menuImgId || ''
  }
}, { immediate: true })

const rules = {
  required: v => !!v || '필수 입력 값입니다.',
  uppercase: v => /^[A-Z0-9]+$/.test(v) || '대문자와 숫자만 입력하세요.'
}
const toUpper = (val) => { local.value.id = (val || '').toUpperCase() }

// ----- Cloudinary Upload Widget -----
let widget
const lastPublicId = ref('')
const cld = computed(() => new Cloudinary({ cloud: { cloudName: props.cloudName } }))
const preview = ref(null)

onMounted(() => {
  // Create once when mounted
  widget = window.cloudinary?.createUploadWidget(
    {
      cloudName: props.cloudName,
      uploadPreset: props.uploadPreset,
      sources: ['local', 'url', 'camera'],
      multiple: false,
      folder: 'images',
      maxFileSize: 5_000_000,
      cropping: false,
      clientAllowedFormats: ['jpg', 'jpeg', 'png', 'webp'],
      showAdvancedOptions: false,
      showPoweredBy: false,
      styles: { palette: { windowBorder: '#ddd' } }
    },
    (error, result) => {
      if (!error && result && result.event === 'success') {
        const info = result.info
        lastPublicId.value = info.public_id
        local.value.menuImgId = lastPublicId.value
      } else if (result && result.event === 'close') {
        lastPublicId.value = ''
      } else if (error) {
        lastPublicId.value = ''
      }
    }
  )
})

function openWidget() { widget && widget.open() }

function openMenuPreview() {
  if (local.value.menuImgId) {
    preview.value = cld.value.image(local.value.menuImgId).format('auto').quality('auto')
    isMenuImgPopup.value = true
  } else if (local.value.menuUrl) {
    window.open(local.value.menuUrl, '_blank', 'noopener')
  }
}

const isMenuImgPopup = ref(false)

// ----- Block control -----
const isBlocked = computed(() => props.blockList?.includes(local.value.id))

async function saveBlockList(nextList) {
  const dbRef = firebaseRef(database, `lunch-resv/blockRestaurant/resv/${props.uid}`)
  await set(dbRef, nextList)
  emit('block-changed', nextList)
}

async function toggleBlock() {
  if (!local.value.id) return
  const list = new Set(props.blockList || [])
  if (list.has(local.value.id)) {
    list.delete(local.value.id)
  }
  else { list.add(local.value.id) };

  await saveBlockList(Array.from(list))
}

// ----- Save restaurant -----
async function saveRestaurant() {
  if (!local.value.id || !local.value.name) return
  const payload = {
    name: local.value.name,
    telNo: local.value.telNo || '',
    menuUrl: local.value.menuImgId ? '' : (local.value.menuUrl || ''),
    kind: local.value.kind || '',
    menuImgId: local.value.menuImgId || ''
  }
  const path = `lunch-resv/restaurant/${local.value.id}`
  const dbRef = firebaseRef(database, path)
  await update(dbRef, payload)
  emit('saved', { id: local.value.id, ...payload })
  isOpen.value = false
}

function close() {
  isOpen.value = false
  emit('closed')
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="600px">
    <v-card>
      <v-card-title>{{ props.isAdd ? '식당 등록' : (local.id || '식당 수정') }}</v-card-title>
      <v-card-text>
        <v-text-field v-if="props.isAdd" v-model="local.id" label="식당 ID" variant="outlined"
          :rules="[rules.required, rules.uppercase]" @update:model-value="toUpper" />

        <v-text-field v-model="local.name" label="식당명" variant="outlined" :rules="[rules.required]" />

        <v-combobox v-model="local.kind" label="종류" :items="Object.keys(props.restaurantKind || {})"
          variant="outlined" />

        <v-text-field v-model="local.telNo" label="전화번호" variant="outlined" />

        <v-row>
          <v-col cols="10">
            <v-text-field v-if="local.menuImgId" v-model="local.menuImgId" label="메뉴 이미지 ID" variant="outlined"
              class="menu-url-field" />
            <v-text-field v-else v-model="local.menuUrl" label="메뉴 URL" variant="outlined" class="menu-url-field" />
          </v-col>
          <v-col cols="2" class="d-flex justify-center align-center">
            <v-btn @click="openWidget" icon="mdi-camera" variant="text" />
          </v-col>
        </v-row>

        <v-alert v-if="!props.isAdd && !local.id" type="warning" variant="tonal" class="mt-2">
          식당 ID가 비어 있습니다.
        </v-alert>

        <div class="mt-2">
          <v-btn variant="text" size="small"
            @click="emit('preview', { menuImgId: local.menuImgId, menuUrl: local.menuUrl })">
            <v-icon start>mdi-feature-search-outline</v-icon> 메뉴 보기
          </v-btn>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-btn icon="mdi-cancel" :color="isBlocked ? 'red' : 'black'" @click="toggleBlock"
          :title="isBlocked ? '숨김취소' : '숨김'" />
        <v-spacer />
        <v-btn icon="mdi-check-bold" @click="saveRestaurant" />
        <v-btn icon="mdi-close-thick" @click="close" />
      </v-card-actions>
    </v-card>
  </v-dialog>

</template>

<style scoped>
.menu-url-field input {
  white-space: nowrap;
  overflow-x: auto;
}
</style>
