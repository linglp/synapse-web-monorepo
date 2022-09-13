import * as React from 'react'
import { useMemo, useState } from 'react'
import { useDeepCompareEffectNoCheck } from 'use-deep-compare-effect'
import {
  isFacetAvailable,
  removeLockedColumnFromFacetData,
} from '../utils/functions/queryUtils'
import { useGetEntity } from '../utils/hooks/SynapseAPI/entity/useEntity'
import { useGetQueryResultBundleWithAsyncStatus } from '../utils/hooks/SynapseAPI/entity/useGetQueryResultBundle'
import {
  AsynchronousJobStatus,
  QueryBundleRequest,
  QueryResultBundle,
  Table,
} from '../utils/synapseTypes'
import {
  LockedColumn,
  PaginatedQueryContextType,
  QueryContextProvider,
} from './QueryContext'
import useImmutableTableQuery from './useImmutableTableQuery'

export const QUERY_FILTERS_EXPANDED_CSS: string = 'isShowingFacetFilters'
export const QUERY_FILTERS_COLLAPSED_CSS: string = 'isHidingFacetFilters'

export type QueryWrapperProps = {
  children: React.ReactNode | React.ReactNode[]
  initQueryRequest: QueryBundleRequest
  componentIndex?: number //used for deep linking
  shouldDeepLink?: boolean
  onQueryChange?: (newQueryJson: string) => void
  onQueryResultBundleChange?: (newQueryResultBundleJson: string) => void
  lockedColumn?: LockedColumn
}

export type SearchQuery = {
  columnName: string
  searchText: string
}

/**
 * Component that manages the state of a Synapse table query. Data can be accessed via QueryContext using
 * either `useQueryContext` or `QueryContextConsumer`.
 */
export function QueryWrapper(props: QueryWrapperProps) {
  const {
    initQueryRequest,
    onQueryChange,
    onQueryResultBundleChange,
    lockedColumn,
    componentIndex,
    shouldDeepLink,
  } = props

  const [currentAsyncStatus, setCurrentAsyncStatus] = useState<
    AsynchronousJobStatus<QueryBundleRequest, QueryResultBundle> | undefined
  >(undefined)

  const {
    entityId,
    versionNumber,
    getInitQueryRequest,
    getLastQueryRequest,
    setQuery,
    currentPage,
    pageSize,
    goToPage,
    setPageSize,
  } = useImmutableTableQuery({
    initQueryRequest,
    shouldDeepLink,
    componentIndex,
    onQueryChange,
  })

  const lastQueryRequest = useMemo(() => {
    return getLastQueryRequest()
  }, [getLastQueryRequest])

  const {
    data: asyncJobStatus,
    isLoading: queryIsLoading,
    error,
    isPreviousData: newQueryIsFetching,
  } = useGetQueryResultBundleWithAsyncStatus(
    lastQueryRequest,
    {
      // We use `keepPreviousData` because we don't want to clear out the current data when the query is modified via the UI
      keepPreviousData: true,
    },
    setCurrentAsyncStatus,
  )

  const data = asyncJobStatus?.responseBody

  // Indicate if we're fetching data for the first time (queryIsLoading) or if we're fetching data for a brand new query (newQueryIsFetching)
  const isLoadingNewBundle = queryIsLoading || newQueryIsFetching

  const { data: entity } = useGetEntity<Table>(entityId, versionNumber)

  // data is sometimes undefined, which useDeepCompareEffect doesn't like, so use useDeepCompareEffectNoCheck instead
  useDeepCompareEffectNoCheck(() => {
    if (data && onQueryResultBundleChange) {
      onQueryResultBundleChange(JSON.stringify(data))
    }
  }, [data, onQueryResultBundleChange])

  const isFacetsAvailable = data
    ? isFacetAvailable(data.facets, data.selectColumns)
    : true

  /**
   * remove a particular facet name (e.g. study) and its all possible values based on the parameter specified in the url
   * this is to remove the facet from the charts, search and filter.
   * @return data: QueryResultBundle
   */
  const dataWithLockedColumnFacetRemoved = useMemo(() => {
    return removeLockedColumnFromFacetData(data, lockedColumn)
  }, [data, lockedColumn])

  const context: PaginatedQueryContextType = {
    data: dataWithLockedColumnFacetRemoved,
    currentPage,
    pageSize,
    setPageSize,
    isLoadingNewBundle: isLoadingNewBundle,
    getLastQueryRequest,
    getInitQueryRequest,
    error: error,
    entity,
    executeQueryRequest: setQuery,
    isFacetsAvailable,
    asyncJobStatus: currentAsyncStatus,
    goToPage,
  }
  /**
   * Render the children without any formatting
   */
  const { children } = props
  const loadingCursorClass = isLoadingNewBundle ? 'SRC-logo-cursor' : ''
  return (
    <QueryContextProvider queryContext={context}>
      <div
        className={`SRC-wrapper ${loadingCursorClass} ${
          isFacetsAvailable ? 'has-facets' : ''
        }`}
      >
        {children}
      </div>
    </QueryContextProvider>
  )
}
