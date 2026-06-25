<script lang="ts" setup>
	import { reactive } from "vue"
	import type { ZoneTreeNode } from "#/zone"

	defineProps<{
		nodes: ZoneTreeNode[]
		selectedId: string | null
		depth?: number
	}>()

	const emit = defineEmits<{
		(e: "select", node: ZoneTreeNode): void
		(e: "add-child", node: ZoneTreeNode): void
		(e: "edit", node: ZoneTreeNode): void
		(e: "delete", node: ZoneTreeNode): void
	}>()

	// Pliage local à ce niveau (chaque sous-arbre gère le sien).
	const collapsed = reactive<Record<string, boolean>>({})
	const toggle = (id: string) => {
		collapsed[id] = !collapsed[id]
	}
</script>

<template>
	<ul class="ztree">
		<li
			v-for="node in nodes"
			:key="node.id"
			class="ztree__item">
			<div
				class="znode"
				:class="{ selected: node.id === selectedId }"
				@click="emit('select', node)">
				<button
					v-if="node.children.length"
					class="znode__caret"
					:class="{ open: !collapsed[node.id] }"
					:aria-label="collapsed[node.id] ? 'Déplier' : 'Replier'"
					@click.stop="toggle(node.id)">
					▸
				</button>
				<span
					v-else
					class="znode__caret znode__caret--leaf">
					·
				</span>

				<span class="znode__name">{{ node.name }}</span>
				<span
					v-if="node.type"
					class="znode__type">
					{{ node.type }}
				</span>
				<span
					v-if="node.sensorCount > 0"
					class="znode__count"
					:title="`${node.sensorCount} capteur(s)`">
					⬡ {{ node.sensorCount }}
				</span>

				<span class="znode__actions">
					<button
						class="zact"
						title="Ajouter une sous-zone"
						@click.stop="emit('add-child', node)">
						+
					</button>
					<button
						class="zact"
						title="Renommer"
						@click.stop="emit('edit', node)">
						✎
					</button>
					<button
						class="zact zact--danger"
						title="Supprimer"
						@click.stop="emit('delete', node)">
						✕
					</button>
				</span>
			</div>

			<!-- Récursion : on se ré-appelle pour les enfants -->
			<ZoneTree
				v-if="node.children.length && !collapsed[node.id]"
				:nodes="node.children"
				:selected-id="selectedId"
				:depth="(depth ?? 0) + 1"
				@select="emit('select', $event)"
				@add-child="emit('add-child', $event)"
				@edit="emit('edit', $event)"
				@delete="emit('delete', $event)" />
		</li>
	</ul>
</template>

<style scoped>
	.ztree {
		list-style: none;
		margin: 0;
		padding: 0;
		padding-left: 14px;
		border-left: 1px solid var(--color-border);
	}

	/* La racine (depth 0) n'a pas de filet à gauche */
	.ztree:not(.ztree .ztree) {
		border-left: none;
		padding-left: 0;
	}

	.znode {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		cursor: pointer;
		border-left: 2px solid transparent;
		font-family: var(--font-mono);
		font-size: 0.74rem;
		color: var(--color-text-muted);
		transition: background var(--dur-fast), color var(--dur-fast);
	}

	.znode:hover {
		background: var(--color-sidebar-hover);
		color: var(--color-text);
	}

	.znode.selected {
		background: var(--color-primary-dim);
		color: var(--color-primary);
		border-left-color: var(--color-primary);
		box-shadow: inset 0 0 18px var(--color-primary-dim);
	}

	.znode__caret {
		background: none;
		border: none;
		color: var(--color-text-muted);
		cursor: pointer;
		width: 14px;
		flex-shrink: 0;
		font-size: 0.7rem;
		padding: 0;
		transition: transform var(--dur-fast);
	}
	.znode__caret.open {
		transform: rotate(90deg);
		color: var(--color-primary);
	}
	.znode__caret--leaf {
		opacity: 0.4;
		cursor: default;
	}

	.znode__name {
		font-weight: 500;
		color: inherit;
	}

	.znode__type {
		font-size: 0.55rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--color-text-muted);
		border: 1px solid var(--color-border-bright);
		padding: 0 4px;
		border-radius: 0;
	}

	.znode__count {
		font-size: 0.6rem;
		color: var(--color-success);
		margin-left: 2px;
	}

	.znode__actions {
		margin-left: auto;
		display: flex;
		gap: 2px;
		opacity: 0;
		transition: opacity var(--dur-fast);
	}
	.znode:hover .znode__actions,
	.znode.selected .znode__actions {
		opacity: 1;
	}

	.zact {
		background: none;
		border: 1px solid transparent;
		color: var(--color-text-muted);
		cursor: pointer;
		width: 18px;
		height: 18px;
		font-size: 0.7rem;
		line-height: 1;
		padding: 0;
		transition: color var(--dur-fast), border-color var(--dur-fast);
	}
	.zact:hover {
		color: var(--color-primary);
		border-color: var(--color-border-bright);
	}
	.zact--danger:hover {
		color: var(--color-danger);
		border-color: var(--color-danger);
	}
</style>
