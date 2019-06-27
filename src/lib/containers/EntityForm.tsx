import * as React from 'react'
import { default as Form } from 'react-jsonschema-form'
import { JSONSchema6 } from 'json-schema'
import { UserProfile } from '../utils/jsonResponses/UserProfile'
import { SynapseClient } from '../utils'
import { AccessControlList } from '../utils/jsonResponses/AccessControlList'
import { ResourceAccess } from '../utils/jsonResponses/ResourceAccess'
import { Evaluation } from '../utils/jsonResponses/Evaluation'
import { Submission } from '../utils/jsonResponses/Submission'
import { FileEntity } from '../utils/jsonResponses/FileEntity'

// 3. If evaluation queue id is set, then submit to that queue too (and report the submission receipt message if successful)
// 4. Refactor schema definitions into Synapse entity files (props)
const schema: JSONSchema6 = {
  title: 'IDG DREAM Round 2 Survey',
  type: 'object',
  required: ['file'],
  properties: {
    file: {
      type: 'string',
      format: 'data-url',
      title: 'Submission File'
    },
    custom: {
      type: 'string', title: 'If you used any \'named\' algorithms or methods, please list them here',
      default: ''
    },
    multipleChoicesList: {
      type: 'array',
      title: 'What public training data did you use?',
      items: {
        type: 'string',
        enum: [
          'DrugTargetCommons',
          'IDG Pharos',
          'ChEMBL',
          'Drug-Target Explorer'
        ]
      },
      uniqueItems: true
    },
    toggle: {
      title: 'Did you use any private data?',
      type: 'boolean',
      oneOf: [
        {
          title: 'Yes',
          const: true
        },
        {
          title: 'No',
          const: false
        }
      ]
    }
  }
}
const uiSchema = {
  multipleChoicesList: {
    'ui:widget': 'checkboxes'
  },
  toggle: {
    'ui:widget': 'radio'
  }
}
type EntityFormState = {
  error?: any,
  isLoading?: boolean,
  successfullyUploaded: boolean,
  containerId?: string,
  userprofile?: UserProfile,
  successMessage?: string,
  evaluation?: Evaluation
}

export type EntityFormProps = {
  parentContainerId: string,
  token?: string,
  // if evaluationId is set, then also submit the new form entity to an evaluation queue
  evaluationId?: string
}

export default class EntityForm
  extends React.Component<EntityFormProps, EntityFormState> {

  constructor(props: EntityFormProps) {
    super(props)
    this.state = {
      isLoading: true,
      successfullyUploaded: false,
    }
  }

  finishedProcessing = (successMessage: string) => {
    this.setState(
      {
        successMessage,
        isLoading: false,
        successfullyUploaded: true,
      })
  }

  onError = (error: any) => {
    this.setState({
      error,
      isLoading: false,
      successfullyUploaded: false
    })
  }

  onSubmit = ({ formData }: any) => {
    this.setState(
      {
        isLoading: true,
        successfullyUploaded: false
      })

    const submissionFileAndForm: Blob = new Blob([JSON.stringify(formData)], {
      type: 'text/json'
    })
    this.createEntityFile(submissionFileAndForm)
  }

  createEntityFile = (fileContentsBlob: Blob) => {
    const newFileEntity: any = {
      parentId: this.state.containerId,
      name: `${Math.floor(Date.now() / 1000).toString()}.json`,
      concreteType: 'org.sagebionetworks.repo.model.FileEntity',
      dataFileHandleId: '',
    }
    SynapseClient.uploadFile(this.props.token, newFileEntity.name, fileContentsBlob).then(
      (fileUploadComplete: any) => {
        newFileEntity.dataFileHandleId = fileUploadComplete.fileHandleId
        SynapseClient.createEntity(newFileEntity, this.props.token).then((updatedEntity) => {
          if (this.state.evaluation) {
            this.submitToEvaluation(updatedEntity)
          } else {
            this.finishedProcessing('Successfully uploaded.')
          }
        })
      }).catch((error: any) => {
        this.onError(error)
      })
  }

  submitToEvaluation = (entity: FileEntity) => {
    const submission: Submission = {
      entityId: entity.id!,
      versionNumber: entity.versionNumber!,
      userId: this.state.userprofile!.ownerId,
      evaluationId: this.state.evaluation!.id,
    }
    SynapseClient.submitToEvaluation(submission, entity.etag!, this.props.token).then(
      () => {
        this.finishedProcessing(this.state.evaluation!.submissionReceiptMessage)
      }).catch((error: any) => {
        this.onError(error)
      })
  }

  componentDidUpdate(prevProps: any) {
    const shouldUpdate = this.props.token !== prevProps.token
    if (shouldUpdate && this.props.token) {
      SynapseClient.getUserProfile(this.props.token, 'https://repo-prod.prod.sagebase.org').then((profile: any) => {
        this.getTargetFolder(profile, this.props.token!)
      }).catch((_err) => {
        console.log('user profile could not be fetched ', _err)
      })
      if (this.props.evaluationId) {
        SynapseClient.getEvaluation(this.props.evaluationId, this.props.token).then(
          (evaluation: Evaluation) => {
            this.setState({ evaluation })
          }).catch((error: any) => {
            this.onError(error)
          })
      } else {
        this.setState({ evaluation: undefined })
      }
    }
  }

  getTargetFolder = (userprofile: UserProfile, token: string) => {
    const folderName = `${userprofile.userName} - ${schema.title} (submissions)`
    const entityLookupRequest = { entityName: folderName, parentId: this.props.parentContainerId }
    SynapseClient.lookupChildEntity(entityLookupRequest, token).then((entityId) => {
      // ok, found an entity of the same name.
      console.log(`EntityForm uploading to https://www.synapse.org/#!Synapse:${entityId.id}`)
      this.setState({
        userprofile,
        containerId: entityId.id,
        isLoading: false
      })
    }).catch((error: any) => {
      if (error.statusCode === 404) {
        // ok, it's a new folder
        return this.createTargetFolder(folderName, userprofile, token)
      }
      return this.onError(error)
    })
  }

  createTargetFolder = (folderName: string, userprofile: UserProfile, token: string) => {
    const newEntity = {
      name: folderName,
      parentId: this.props.parentContainerId,
      concreteType: 'org.sagebionetworks.repo.model.Folder'
    }
    return SynapseClient.createEntity(newEntity, token).then((entity) => {
      // and set the acl to private by default
      const resourceAccess: ResourceAccess[] = [
        {
          principalId: parseInt(userprofile.ownerId, 10),
          accessType:
          ['READ', 'DOWNLOAD', 'UPDATE', 'DELETE',
            'CREATE', 'CHANGE_PERMISSIONS', 'CHANGE_SETTINGS', 'MODERATE']
        }
      ]
      const acl: AccessControlList = {
        resourceAccess,
        id: entity.id,
      }
      SynapseClient.createACL(entity.id, acl, token).then((acl: AccessControlList) => {
        console.log(`EntityForm uploading to https://www.synapse.org/#!Synapse:${entity.id}`)
        this.setState({
          userprofile,
          containerId: entity.id,
          isLoading: false
        })
      })
    }).catch((error: any) => {
      return this.onError(error)
    })
  }

  render() {
    return (
      <div>
        {
          !this.state.error &&
          this.props.token &&
          !this.state.isLoading &&
          !this.state.successfullyUploaded &&
          <Form
            schema={schema}
            uiSchema={uiSchema}
            onSubmit={this.onSubmit}
            showErrorList={true}
          />
        }
        {
          !this.state.error &&
          this.props.token &&
          this.state.isLoading &&
          <React.Fragment>
            <span style={{ marginLeft: '2px' }} className={'spinner'} />
          </React.Fragment>
        }
        {
          !this.state.error &&
          this.props.token &&
          this.state.successfullyUploaded &&
          <span style={{ marginLeft: '10px' }}>
            {this.state.successMessage}
          </span>
        }
        {
          this.state.error &&
          <p>
            Error: {this.state.error.name || this.state.error.reason}
          </p>
        }
      </div>
    )
  }
}
