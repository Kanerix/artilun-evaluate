<script lang="ts">
	export let border = true
</script>

<tr {...$$props} class="{border ? 'border-b border-slate-200' : ''} {$$props.class || ''}">
	<slot/>
</tr>