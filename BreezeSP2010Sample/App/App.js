﻿'use strict';

var metadataStore;
var contactType;
var entityManager;

jQuery(document).ready(function () {
  // STEP 1: configure breeze
  configureBreeze();

  // STEP 2: define the metadata for the entity
  createMetadata();

  // STEP 3: init breeze
  initBreeze();

  // enable the buttons
  jQuery('input[type="button"]').removeAttr('disabled');
});

// configure breeze
function configureBreeze() {
  // configure breeze to use SharePoint 2010 OData service
  var dsAdapter = breeze.config.initializeAdapterInstance('dataService', 'SharePointOData2010', true);
}

// create the metadata for the rest endpoint
function createMetadata() {
  // create a new breeze metadata store
  metadataStore = new breeze.MetadataStore();

  // setup a helper to create entities
  var namespace = '';
  var helper = new breeze.config.MetadataHelper(namespace, breeze.AutoGeneratedKeyType.Identity);
  // define a new function that uses the helper to
  //  1) create a new entity type in the metadata store
  //  2) create a default select so we don't have to create the
  //    OData $select each time
  var addType = function (typeDef) {
    var entityType = helper.addTypeToStore(metadataStore, typeDef);
    _addDefaultSelect(entityType);
    return entityType;
  };

  // create entity for contacts
  addType({
    name: 'Contacts',
    defaultResourceName: 'Contacts',
    dataProperties: {
      Id: { type: breeze.DataType.Int32 },
      FirstName: { nullable: false },
      LastName: { nullable: false },  // this is actually the last name field in the list
      EMailAddress: {
        nullable: false,
        validators: [breeze.Validator.emailAddress()]
      }
    }
  });

  // add 'defaultSelect' custom metadata that selects for all mapped data properties
  // could be used by SharePoint dataservice adapter to exclude unwanted property data
  // in query payload
  function _addDefaultSelect(type) {
    var custom = type.custom;
    // bail out if defined by hand already
    if (custom && custom.defaultSelect != null) { return; }

    var select = [];
    type.dataProperties.forEach(function (prop) {
      if (!prop.isUnmapped) { select.push(prop.name); }
    });
    if (select.length) {
      if (!custom) { type.custom = custom = {}; }
      custom.defaultSelect = select.join(',');
    }
    return type;
  }

}

// init breeze for queries
function initBreeze() {
  // get reference to contact entity type
  contactType = metadataStore.getEntityType('Contacts');

  // create the data service
  var dataService = new breeze.DataService({
    // tell breeze the root REST endpoint to use
    //  since we only are using lists, point to that
    serviceName: 'http://yoursite.sharepoint.com/_vti_bin/listdata.svc/',
    // tell breeze not to interrogate sharepoint for it's
    //  massive OData $metadata response... we created it manually
    hasServerMetadata: false
  });

  // create an instance of the entity manager
  entityManager = new breeze.EntityManager({
    dataService: dataService,
    // tell breeze where the metadata is
    metadataStore: metadataStore
  });
}

// get all items from sharepoint REST API
function getAllItems() {
  breeze.EntityQuery
    .from(contactType.defaultResourceName)
    .using(entityManager)
    .execute()
    .then(function (response) {
      var results = response.results;
      // write results > div
      if (results && results.length) {
        var message = '';
        for (var index = 0; index < results.length; index++) {
          message += results[index].FirstName + ' ' + results[index].LastName + ' (' + results[index].EMailAddress + ')<br/>';
        }
        jQuery("#results").html(message);
      }
    });
  return false;
}

// get a single item
function getOneItem() {
  // try to get a single item from the cache, then revert to server
  entityManager.fetchEntityByKey('Contacts', 1, true)
  .then(function (data) {
    var message = data.entity.FirstName + ' ' + data.entity.LastName + ' (' + data.entity.EMailAddress + ')<br/>';
    message += 'pulled from: ' + (data.fromCache ? 'cache' : 'server');
    jQuery("#results").html(message);
  });
}

// update an item
function updateFirstItem() {
  // get the first item
  var promise = entityManager.fetchEntityByKey('Contacts', 1, true)
                  .then(function (data) {
                    return data.entity;
                  });
  // update the first item
  promise.then(function (contact) {
    contact.LastName = 'NewName';
    entityManager.saveChanges().then(function () {
      jQuery("#results").html('saved first item in list');
    });
  });
}

// create a new contact
function createItem() {
  // create entity
  var contact = entityManager.createEntity(contactType);
  contact.FirstName = 'Lewis';
  contact.LastName = 'Hamilton';
  contact.EMailAddress = 'lewis.hamilton@mercedes.com';
  // save entity
  entityManager.saveChanges()
    .then(function () {
      jQuery("#results").html('new item created');
    });
}

// deletes the last item in the list
function deleteItem() {
  // delete the last item in the list
  breeze.EntityQuery
    .from(contactType.defaultResourceName)
    .using(entityManager)
    .execute()
    .then(function (response) {
      var results = response.results;
      var lastContact = results[results.length - 1];
      lastContact.entityAspect.setDeleted();
      entityManager.saveChanges()
        .then(function () {
          jQuery("#results").html('last item in list deleted');
        });
    });
}