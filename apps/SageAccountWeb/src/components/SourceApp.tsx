import { Box, PaletteOptions, SxProps, Typography } from '@mui/material'
import React from 'react'
import {
  Palettes,
  SynapseConstants,
  SynapseQueries,
  SkeletonTable,
} from 'synapse-react-client'
import { SourceAppConfig } from './SourceAppConfigs'
import SourceAppImage from './SourceAppImage'
import Skeleton from '@mui/material/Skeleton'
import { useHistory, useLocation } from 'react-router-dom'

const sourceAppConfigTableID = 'syn45291362'
export type SourceAppProps = {
  isAccountCreationTextVisible?: boolean
}

/**
 * This is where the app specific UI will be shown
 * @param props
 * @returns
 */
export const SourceApp = (props: SourceAppProps) => {
  const { isAccountCreationTextVisible = false } = props
  const sourceApp = useSourceApp()
  return (
    <>
      <div className="SourceAppLogo">{sourceApp?.logo}</div>
      {isAccountCreationTextVisible && (
        <div>
          <p>
            A Sage account is required to log into {sourceApp?.friendlyName}.
          </p>
          <p>Create an account to get started.</p>
        </div>
      )}
    </>
  )
}

export const SourceAppLogo: React.FC<{ sx?: SxProps }> = ({ sx }) => {
  const sourceAppConfig = useSourceApp()
  return (
    <Box className="SourceAppLogo" sx={sx}>
      {sourceAppConfig ? (
        sourceAppConfig.logo
      ) : (
        <Skeleton variant="rectangular" width={250} height={65} />
      )}
    </Box>
  )
}

export const SourceAppDescription = () => {
  const sourceAppConfig = useSourceApp()
  return sourceAppConfig ? (
    <Typography className="description" variant="subtitle1">
      {sourceAppConfig?.description}
    </Typography>
  ) : (
    <SkeletonTable numRows={7} numCols={1} />
  )
}

export const useSourceAppConfigs = (): SourceAppConfig[] | undefined => {
  const { data: tableQueryResult } =
    SynapseQueries.useGetQueryResultBundleWithAsyncStatus({
      entityId: sourceAppConfigTableID,
      query: {
        sql: `SELECT * FROM ${sourceAppConfigTableID}`,
        limit: 75,
      },
      partMask: SynapseConstants.BUNDLE_MASK_QUERY_RESULTS,
      concreteType: 'org.sagebionetworks.repo.model.table.QueryBundleRequest',
    })
  const rowSet = tableQueryResult?.responseBody?.queryResult?.queryResults
  // transform row data to SourceAppConfig[]
  const headers = rowSet?.headers
  const appIdColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'appId',
  )!
  const appURLColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'appURL',
  )!
  const friendlyNameColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'friendlyName',
  )!
  const descriptionColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'description',
  )!
  const logoFileHandleColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'logo',
  )!
  const requestAffiliationColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'requestAffiliation',
  )!
  const primaryColorColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'primaryColor',
  )!
  const secondaryColorColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'secondaryColor',
  )!
  const isPublicizedColIndex = headers?.findIndex(
    selectColumn => selectColumn.name == 'isPublicized',
  )!

  const rows = rowSet?.rows
  return rows?.map(row => {
    const rowVals = row.values
    const fileHandleId = rowVals[logoFileHandleColIndex]
    const logo = <SourceAppImage fileHandleId={fileHandleId} />
    const appPalette: PaletteOptions = {
      ...Palettes.palette,
      primary: Palettes.generatePalette(rowVals[primaryColorColIndex] ?? ''),
      secondary: Palettes.generatePalette(
        rowVals[secondaryColorColIndex] ?? '',
      ),
    }
    const sourceAppConfig: SourceAppConfig = {
      appId: rowVals[appIdColIndex] ?? '',
      appURL: rowVals[appURLColIndex] ?? '',
      description: rowVals[descriptionColIndex] ?? '',
      friendlyName: rowVals[friendlyNameColIndex] ?? '',
      requestAffiliation:
        rowVals[requestAffiliationColIndex] == 'true' ?? false,
      logo,
      isPublicized: rowVals[isPublicizedColIndex] == 'true' ?? true,
      palette: appPalette,
    }
    return sourceAppConfig
  })
}

export const useSourceApp = (
  targetSourceAppId?: string,
): SourceAppConfig | undefined => {
  const sourceAppId = targetSourceAppId ?? localStorage.getItem('sourceAppId')
  const sourceAppConfigs = useSourceAppConfigs()

  // Find target source app.  Fallback to Sage Bionetworks source app if target not found.
  const sourceApp = sourceAppConfigs?.find(
    config => config.appId === sourceAppId,
  )
  const defaultSageSourceApp = sourceAppConfigs?.find(
    config => config.appId === 'SAGE',
  )
  if (sourceAppConfigs !== undefined && sourceApp == undefined) {
    console.error(
      `Source appId '${sourceAppId}' not found in the Synapse configuration table (${sourceAppConfigTableID})!`,
    )
    localStorage.setItem('sourceAppId', 'SAGE')
  }
  return sourceApp ?? defaultSageSourceApp
}

export default SourceApp
