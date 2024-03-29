import { z, type ZodIssue } from 'zod'
import prisma from '$lib/server/prisma'
import { fail, redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from '../$types'
import redis from '$lib/server/redis'

interface Invite {
	id: number
	orginization: {
		id: number
		name: string
	}
}

interface LoadData {
	invites: Invite[]
}

export const load: LayoutServerLoad = (async (event): Promise<LoadData> => {
	const user = event.locals.user
	const invites = {
		invites: await prisma.orginizationIvite.findMany({
			where: { userId: user.id },
			select: {
				id: true,
				orginization: {
					select: {
						name: true
					}
				},
			}
		})
	}

	event.depends('invite:accept')

	return invites as { invites: Invite[] }
}) satisfies LayoutServerLoad

const createOrginization = z.object({
	name: z.string().min(3).max(255),
})

export const actions = {
	default: async (event) => {
		const data = await event.request.formData()
		const parseable = Object.fromEntries(data.entries())

		const result = createOrginization.safeParse(parseable)
		if (!result.success) {
			return fail(422, {
				issues: result.error.issues
			})
		}

		const user = event.locals.user
		
		try {
			const hasUser = Boolean(await prisma.orginizationUser.findFirst({
				where: {
					userId: user.id,
				}
			}))

			if (hasUser) {
				return fail(409, {
					issues: [{ 'message': 'User is already a part of an orginization' }] as ZodIssue[]
				})
			}
		} catch (e) {
			console.error(e)

			return fail(500, {
				issues: [{ 'message': 'Internal server error' }] as ZodIssue[]
			})
		}

		try {
			await prisma.orginizationUser.create({
				data: {
					role: 'OWNER',
					user: {
						connect: {
							id: user.id
						}	
					},
					orginization: {
						create: {
							name: result.data.name
						}
					}
				},
			})


			redis.set(`blocked:${user.id}`, '1', 'EX', 900)
		} catch (e) {
			console.error(e)

			return fail(500, {
				issues: [{ 'message': 'Internal server error' }] as ZodIssue[]
			})
		}

		event.cookies.delete('access_token')

		throw redirect(303, '/login')
	}
}