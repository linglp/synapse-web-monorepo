import {
  UseInfiniteQueryOptions,
  useInfiniteQuery,
  UseMutationOptions,
  useQueryClient,
  useMutation,
} from 'react-query'
import { SynapseClient } from '../../..'
import { SynapseClientError } from '../../../SynapseClientError'
import { useSynapseContext } from '../../../SynapseContext'
import {
  CreateDiscussionReply,
  DiscussionFilter,
  DiscussionReplyBundle,
  DiscussionReplyOrder,
  UpdateDiscussionReply,
} from '../../../synapseTypes/DiscussionBundle'
import { PaginatedResults } from '../../../synapseTypes'
import { Match } from '../../../synapseTypes/DiscussionSearch'

export function useGetRepliesInfinite(
  threadId: string,
  ascending: boolean,
  limit: number,
  sort?: DiscussionReplyOrder,
  filter?: DiscussionFilter,
  options?: UseInfiniteQueryOptions<
    PaginatedResults<DiscussionReplyBundle>,
    SynapseClientError
  >,
) {
  const { accessToken } = useSynapseContext()
  return useInfiniteQuery<
    PaginatedResults<DiscussionReplyBundle>,
    SynapseClientError
  >(
    ['thread', threadId, 'infinite', limit, filter, sort, ascending],
    async context => {
      return SynapseClient.getReplies(
        accessToken,
        threadId,
        limit,
        context.pageParam,
        sort,
        ascending,
        filter,
      )
    },
    {
      ...options,
      getNextPageParam: (lastPage, pages) => {
        if (lastPage.results.length > 0) return pages.length * limit
        else return undefined
      },
    },
  )
}

export function usePostReply(
  options?: UseMutationOptions<
    DiscussionReplyBundle,
    SynapseClientError,
    CreateDiscussionReply
  >,
) {
  const queryClient = useQueryClient()
  const { accessToken } = useSynapseContext()

  return useMutation<
    DiscussionReplyBundle,
    SynapseClientError,
    CreateDiscussionReply
  >(
    (request: CreateDiscussionReply) =>
      SynapseClient.postReply(request, accessToken),
    {
      ...options,
      onSuccess: async (newReply, variables, ctx) => {
        await queryClient.invalidateQueries(['thread', newReply.threadId])
        if (options?.onSuccess) {
          await options.onSuccess(newReply, variables, ctx)
        }
      },
    },
  )
}

export function usePutReply(
  options?: UseMutationOptions<
    DiscussionReplyBundle,
    SynapseClientError,
    UpdateDiscussionReply
  >,
) {
  const queryClient = useQueryClient()
  const { accessToken } = useSynapseContext()

  return useMutation<
    DiscussionReplyBundle,
    SynapseClientError,
    UpdateDiscussionReply
  >(
    (request: UpdateDiscussionReply) =>
      SynapseClient.putReply(request, accessToken),
    {
      ...options,
      onSuccess: async (newReply, variables, ctx) => {
        await queryClient.invalidateQueries(['thread', newReply.threadId])
        if (options?.onSuccess) {
          await options.onSuccess(newReply, variables, ctx)
        }
      },
    },
  )
}

export function useDeleteReply(
  options?: UseMutationOptions<void, SynapseClientError, Match>,
) {
  const queryClient = useQueryClient()
  const { accessToken } = useSynapseContext()

  return useMutation<void, SynapseClientError, Match>(
    (match: Match) => SynapseClient.deleteReply(accessToken, match.replyId),
    {
      ...options,
      onSuccess: async (updatedReply, variables, ctx) => {
        await queryClient.invalidateQueries(['thread', variables.threadId])
        if (options?.onSuccess) {
          await options.onSuccess(updatedReply, variables, ctx)
        }
      },
    },
  )
}
