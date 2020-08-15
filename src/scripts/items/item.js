import { EventDispatcher, Vector3 } from 'three';
import { EVENT_UPDATED } from '../core/events';
import { Utils } from '../core/utils';

/**
 * An Item is an abstract entity for all things placed in the scene, e.g. at
 * walls or on the floor.
 */
export class Item extends EventDispatcher {
    /**
     * Constructs an item. This is a pure data representation of a room item.
     * Because floorplanner is pure MVC or MVP it is the responsibility of the respective viewer
     * to create the physical entity based on the item data
     *
     * @param model
     *            TODO
     * @param metadata
     *            TODO
     * @param id
     *            TODO
     */
    constructor(metadata, model, id) {
        super();

        /**
         * @property {String} id The id of this corner. Autogenerated the first time
         * @type {String}
         **/
        this.__id = id || Utils.guide();
        this.__metadata = metadata;
        this.__model = model;
        this.__position = new Vector3();
        this.__rotation = new Vector3();
        this.__scale = new Vector3(1, 1, 1);

        this.__size = new Vector3(1, 1, 1);

        /** */
        this.__hover = false; //This is part of application logic only
        /** */
        this.__selected = false; //This is part of application logic only
        this.__freePosition = true; //This is part of application logic only
        this.__boundToFloor = false; //This is part of application logic only
        this.__allowRotate = true; //This is part of application logic only

        this.__fixed = false; //This is part of application logic and also Metadata
        this.__resizable = false; //This is part of application logic and also Metadata

        this.castShadow = false;
        this.receiveShadow = false;
        this.__initializeMetaData();
    }

    __initializeMetaData() {
        this.__fixed = (this.__metadata.fixed) ? this.__metadata.fixed : true;
        this.__resizable = (this.__metadata.resizable) ? this.__metadata.resizable : true;
        if (this.__metadata.position.length) {
            this.__position = new Vector3().fromArray(this.__metadata.position).clone();
        }
        if (this.__metadata.rotation.length) {
            this.__rotation = new Vector3().fromArray(this.__metadata.rotation).clone();
        }
        if (this.__metadata.scale.length) {
            this.__scale = new Vector3().fromArray(this.__metadata.scale).clone();
        }
        if (this.__metadata.size.length) {
            this.__size = new Vector3().fromArray(this.__metadata.size).clone();
        }
    }

    /** */
    __moveToPosition() {}

    __getMetaData() {
        return {
            id: this.id,
            itemName: this.metadata.itemName,
            itemType: this.metadata.itemType,
            modelURL: this.metadata.modelUrl,
            position: this.position.toArray(),
            rotation: this.rotation.toArray(),
            scale: this.scale.toArray(),
            size: this.size.toArray(),
            fixed: this.__fixed,
            resizable: this.__resizable
        };
    }

    __metaDataUpdate(propertyname) {
        this.dispatchEvent({ type: EVENT_UPDATED, property: propertyname });
    }

    updateMetadataExplicit() {
        this.__metadata = this.__getMetaData();
    }

    get id() {
        return this.__id;
    }

    get metadata() {
        return this.__metadata;
    }

    set metadata(mdata) {
        this.__metadata = mdata;
        this.__applyMetaData();
    }

    get position() {
        return this.__position;
    }
    set position(p) {
        this.__position.copy(p);
        this.__metadata.position = this.__position.toArray();
        this.__moveToPosition();
        this.__metaDataUpdate('position');
    }

    get rotation() {
        return this.__rotation;
    }

    set rotation(r) {
        this.__rotation.copy(r);
        this.__metadata.rotation = this.__rotation.toArray();
        this.__metaDataUpdate('rotation');
    }

    get scale() {
        return this.__scale;
    }

    set scale(s) {
            this.__scale.copy(s);
            this.__metadata.scale = this.__scale.toArray();
            this.__metaDataUpdate('scale');
        }
        /**
         * This is a read-only property. This can be changed only internally with private and protected acces
         */
    get size() {
        return this.__size.clone();
    }

    get modelURL() {
        return this.__metadata.modelURL;
    }

    set modelURL(value) {
        this.__metadata.modelURL = value;
        this.__metaDataUpdate('modelURL');
    }

    get fixed() {
        return this.__fixed;
    }

    set fixed(flag) {
        this.__fixed = flag;
        this.__metaDataUpdate('fixed');
    }

    get resizable() {
        return this.__resizable;
    }

    get itemName() {
        return this.__metadata.itemName;
    }

    get itemType() {
        return this.__metadata.itemType;
    }
}