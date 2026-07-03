<template>
	<div class="user-sensor-access">
		<UserForm
			submitFunction="sensor.access"
			title="Demander l'accès à un capteur" />
	</div>
</template>

<script lang="ts">
	import { defineComponent } from "vue"
	import UserForm from "@/components/user/UserForm.vue"

	export default defineComponent({
		name: "UserSensorAccess",
		components: {
			UserForm,
		},
	})
</script>

<style lang="scss" scoped></style>
