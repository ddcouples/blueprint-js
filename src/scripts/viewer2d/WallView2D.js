import { BaseFloorplanViewElement2D } from './BaseFloorplanViewElement2D.js';
import { EVENT_MOVED, EVENT_UPDATED, EVENT_DELETED } from '../core/events.js';
import { WallTypes } from '../core/constants.js';
import { Dimensioning } from '../core/dimensioning.js';
import { Graphics, Text, Point } from 'pixi.js';
import { Vector3, Vector2, Color } from 'three';
import { Configuration, snapToGrid, snapTolerance, dragOnlyX, dragOnlyY, directionalDrag } from '../core/configuration.js';
import { isMobile } from 'detect-touch-device';
// import  debounce from 'lodash.debounce'
import throttle from 'lodash.throttle'

export class WallDimensions2D extends Graphics {
    constructor(floorplan, options, wall) {
        super();
        var opts = { dimlinecolor: '#3EDEDE', dimarrowcolor: '#000000', dimtextcolor: '#000000', };
        for (var opt in opts) {
            if (opts.hasOwnProperty(opt) && options.hasOwnProperty(opt)) {
                opts[opt] = options[opt];
            }
        }
        opts.dimlinecolor = new Color(opts.dimlinecolor).getHex();
        opts.dimarrowcolor = new Color(opts.dimarrowcolor).getHex();
        opts.dimtextcolor = new Color(opts.dimtextcolor).getHex();

        this.__floorplan = floorplan;
        this.__options = opts;
        this.__wall = wall;
        this.__textfield = new Text('Length: ', { fontFamily: 'Arial', fontSize: 12, fontWeight: 600 , fill: this.__options.dimtextcolor, align: 'center' });
        this.__textfield.anchor.set(0.5, 0.5);
        this.interactive = this.__textfield.interactive = false;
        this.timer = null
        this.addChild(this.__textfield);
        this.update();
    }

    __getPolygon(start, radius, sides, rotation = 0.0) {
        let points = [];
        for (let i = 0; i < sides; i++) {
            let theta = (i / sides) * Math.PI * 2.0;
            let xx = (Math.sin(theta + rotation) * radius) + start.x;
            let yy = (Math.cos(theta + rotation) * radius) + start.y;
            points.push(new Vector2(xx, yy));
        }

        return points;
    }

    __wallNormal() {
        if (this.__wall.attachedRooms.length) {
            return this.__wall.attachedRooms[0].getWallOutDirection(this.__wall);
        }
        let wallDirectionNormalized2D = this.__wall.wallDirectionNormalized();
        let wallDirectionNormalized = new Vector3(wallDirectionNormalized2D.x, wallDirectionNormalized2D.y, 0);
        wallDirectionNormalized.applyAxisAngle(new Vector3(0, 0, 1), 1.57);
        return wallDirectionNormalized;
    }

    __wallOffsetLocation(point2d, offset = 20) {
        let wallOutDirection = this.__wallNormal();
        if (wallOutDirection === null) {
            wallOutDirection = new Vector3(0, 1, 0);
        }
        let bestLocation = point2d.add(wallOutDirection.multiplyScalar(offset));
        return this.__toPixels(bestLocation);
    }

    __wallOffsetLocationFromCenter(offset = 20) {
        let wallCenter2D = this.__wall.wallCenter().clone();
        let bestLocation = this.__wallOffsetLocation(wallCenter2D, offset); //wallCenter.add(wallOutDirection.multiplyScalar(offset));
        return bestLocation;
    }

    __toPixels(vector) {
        vector.x = Dimensioning.cmToPixel(vector.x);
        vector.y = Dimensioning.cmToPixel(vector.y);
        return vector;
    }

    __drawDimensionLine() {
        // console.trace('DRAW DIMENSION LINE ::: ', this.__wall);
        let wallDirectionNormalized = this.__wall.wallDirectionNormalized();
        let wallAngle = this.__wall.wallDirectionNormalized().angle();
        let p1Start = this.__toPixels(this.__wall.start.location.clone());
        let p1End = this.__wallOffsetLocation(this.__wall.start.location.clone(), 100);

        let p2Start = this.__toPixels(this.__wall.end.location.clone());
        let p2End = this.__wallOffsetLocation(this.__wall.end.location.clone(), 100);

        let p1Center = this.__wallOffsetLocation(this.__wall.start.location.clone(), 50);
        let p2Center = this.__wallOffsetLocation(this.__wall.end.location.clone(), 50);
        //Draw the line at wall start
        this.clear();
        this.lineStyle(1*window.devicePixelRatio, this.__options.dimlinecolor);

        this.moveTo(p1Start.x, p1Start.y);
        this.lineTo(p1End.x, p1End.y);

        this.moveTo(p2Start.x, p2Start.y);
        this.lineTo(p2End.x, p2End.y);

        this.moveTo(p1Center.x, p1Center.y);
        this.lineTo(p2Center.x, p2Center.y);


        let radius = 5;
        let p4 = p1Center.add(wallDirectionNormalized.clone().multiplyScalar(radius));
        let p5 = p2Center.sub(wallDirectionNormalized.clone().multiplyScalar(radius));

        let arrow1 = this.__getPolygon(p4, radius, 4, wallAngle + 1.57);
        let arrow2 = this.__getPolygon(p5, radius, 4, wallAngle + 1.57);
        let i = 0;
        this.beginFill(this.__options.dimarrowcolor, 1.0);
        this.moveTo(arrow1[0].x, arrow1[0].y);
        for (i = 1; i < arrow1.length; i++) {
            this.lineTo(arrow1[i].x, arrow1[i].y);
        }
        this.lineTo(arrow1[0].x, arrow1[0].y);

        this.moveTo(arrow2[0].x, arrow2[0].y);
        for (i = 1; i < arrow2.length; i++) {
            this.lineTo(arrow2[i].x, arrow2[i].y);
        }
        this.lineTo(arrow2[0].x, arrow2[0].y);
        this.endFill();
        const textPosition = p1Center.add(p2Center);
        this.__textfield.position.x = textPosition.x / 2
        this.__textfield.position.y =  textPosition.y / 2
        if (wallAngle > Math.PI / 2 && wallAngle < Math.PI) {
            this.__textfield.rotation = Math.PI + wallAngle;
        } else if (wallAngle >= Math.PI && wallAngle < Math.PI * 3 / 2) {
            this.__textfield.rotation =  wallAngle - Math.PI;
        } else {
            this.__textfield.rotation = wallAngle;
        }
        
    }

    __updateDimensionText() {
        let location = this.__wallOffsetLocationFromCenter(2);
        this.__textfield.text = Dimensioning.cmToMeasure(this.__wall.wallSize);
        // this.__textfield.position.x = location.x;
        // this.__textfield.position.y = location.y;
    }

    update() {
        this.__drawDimensionLine();
        clearTimeout(this.timer)
        this.timer = setTimeout(() => {
            this.__drawDimensionLine();
        }, 300)
        
        this.__updateDimensionText();
    }

}

export class Edge2D extends BaseFloorplanViewElement2D {
    constructor(floorplan, options, wall, edge) {
        super(floorplan, options);
        this.__wall = wall;
        this.__edge = edge;
        this.__debugMode = false;
        this.__deactivate();
    }

    __getCornerCoordinates() {
        // let sPoint = Dimensioning.cmToPixelVector2D(this.__wall.start.location.clone());
        // let ePoint = Dimensioning.cmToPixelVector2D(this.__wall.end.location.clone());

        // return [sPoint, ePoint];

        let iStartPoint = Dimensioning.cmToPixelVector2D(this.__edge.interiorStart());
        let iEndPoint = Dimensioning.cmToPixelVector2D(this.__edge.interiorEnd());

        let eStartPoint = Dimensioning.cmToPixelVector2D(this.__edge.exteriorStart());
        let eEndPoint = Dimensioning.cmToPixelVector2D(this.__edge.exteriorEnd());

        let vectStart = eStartPoint.clone().sub(iStartPoint);
        let vectEnd = eEndPoint.clone().sub(iEndPoint);

        return [iStartPoint.add(vectStart.multiplyScalar(0.5)), iEndPoint.add(vectEnd.multiplyScalar(0.5))];
        
    }

    __getPolygonCoordinates(forEdge) {
        let points = [
            forEdge.exteriorStart(this.__debugMode), 
            forEdge.exteriorEnd(this.__debugMode), 
            forEdge.interiorEnd(this.__debugMode), 
            forEdge.interiorStart(this.__debugMode)];
        if (isMobile) {
            let pixelPoints = [];
            let start = forEdge.getStart().location;
            let end = forEdge.getEnd().location;
            let origins = [start, end, end, start];
            for (let i = 0; i < points.length; i++) {
                let point = points[i];
                let origin = origins[i];
                let vect = point.clone().sub(origin);

                vect = vect.multiplyScalar(3.0).add(origin);
                let pixelPoint = Dimensioning.cmToPixelVector2D(vect); //new Vector2(Dimensioning.cmToPixel(vect.x), Dimensioning.cmToPixel(vect.y));
                pixelPoints.push(pixelPoint);
            }
            return pixelPoints;
        }
        for (let i = 0; i < points.length; i++) {
            console.log('>>>> before cm', points[i])
            points[i] = Dimensioning.cmToPixelVector2D(points[i]);
            console.log('>>>> after pixel', points[i])
        }
        return points;
    }

    __drawEdgeArrow(forEdge, color = 0xDDDDDD, alpha = 1.0) {
        let start = Dimensioning.cmToPixelVector2D(forEdge.getStart().location.clone());
        let end = Dimensioning.cmToPixelVector2D(forEdge.getEnd().location.clone());
        let vect = end.clone().sub(start);
        let midPoint = start.clone().add(vect.multiplyScalar(0.5));
        let lineThickness = 3.0;
        let arrowSize = 7;
        let dotSize = 5;

        this.lineStyle(lineThickness, color, alpha);
        this.moveTo(start.x, start.y);
        this.lineTo(midPoint.x, midPoint.y);

        this.beginFill(color, alpha);
        this.drawCircle(start.x, start.y, dotSize);
        this.drawRect(midPoint.x - arrowSize * 0.5, midPoint.y - arrowSize * 0.5, arrowSize, arrowSize);
        this.endFill();
    }

    __drawEdgePolygon(forEdge, color = 0xDDDDDD, alpha = 1.0, borderColor=0x000000) {
        let points = this.__getPolygonCoordinates(forEdge);
        
        this.clear();
        let lineThickness = 1;
        
        let pStart = points[2];
        let pEnd = points[3];
        console.log('Edge2D >>>>>>>>>>>>> __drawEdgePolygon', points)

        // let pStart = points[0].clone().add(points[0].clone().sub(points[3]).multiplyScalar(0.5)); 
        // let pEnd = points[1].clone().add(points[2].clone().sub(points[3]).multiplyScalar(0.5)); 

        // this.lineStyle(lineThickness, borderColor);
        // // this.moveTo(pStart.x, pStart.y);
        // // this.lineTo(pEnd.x, pEnd.y);
        if (this.__wall._walltype === WallTypes.CURVED) {
            const startBesizVector = Dimensioning.cmToPixelVector2D(this.__wall.start)
            const endBesizVector = Dimensioning.cmToPixelVector2D(this.__wall.end)
            const thickness = Dimensioning.cmToPixel(this.__wall.thickness)
            const besizVector = Dimensioning.cmToPixelVector2D(this.__wall._a)
            this.lineStyle(1, 0x00ff00)
            // this.beginFill(color, alpha);
            this.moveTo(endBesizVector.x, endBesizVector.y);
            // this.bezierCurveTo(besizVector.x, besizVector.y, besizVector.x, besizVector.y, endBesizVector.x, endBesizVector.y)
            // this.lineStyle(1, color)
            this.bezierCurveTo(besizVector.x, besizVector.y, besizVector.x, besizVector.y, startBesizVector.x + 1, startBesizVector.y +1)
            // this.endFill();
            console.log(this.__wall.thickness, thickness, besizVector, 'Edge2D >>>>>>>>>>>>> __drawEdgePolygon')
            // return
        }

        this.lineStyle(lineThickness, borderColor);
        this.beginFill(color, alpha);
        for (let i = 0; i < points.length; i++) {
            let pt = points[i];
            if (i === 0) {
                this.moveTo(pt.x, pt.y);
            } else {
                this.lineTo(pt.x, pt.y);
            }
        }
        this.endFill();
    }

    drawEdge(color = 0xDDDDDD, alpha = 1.0) {
        this.clear();
        // if(!this.__edge.room){
        //     return;
        // }
        let alpha_new = (this.__debugMode) ? 0.1 : alpha;
        const borderColor = 0x000000;
        this.__drawEdgePolygon(this.__edge, color, alpha_new, borderColor);//0.1);//

        if (this.__debugMode) {
            this.__drawEdgeArrow(this.__edge, 0x000000, alpha);
            if (this.__edge.prev) { //Red for previous edge
                this.__drawEdgeArrow(this.__edge.prev, 0xFF0000, alpha);
            }
            if (this.__edge.next) { //Blue for Next edge
                this.__drawEdgeArrow(this.__edge.next, 0x0000FF, alpha);
            }
        }

        // if(!this.__debugMode){
        //     let cornerLine = this.__getCornerCoordinates();
        //     let lineThickness = 1.5; //Math.min(Dimensioning.cmToPixel(this.__wall.thickness * 0.25), 1.0);
        //     this.lineStyle(lineThickness, 0xF0F0F0);
        //     this.moveTo(cornerLine[1].x, cornerLine[1].y);
        //     this.lineTo(cornerLine[0].x, cornerLine[0].y);
        // }        
    }

    get edge() {
        return this.__edge;
    }

    get debugMode() {
        return this.__debugMode;
    }

    set debugMode(flag) {
        this.__debugMode = flag;
    }
}

export class WallView2D extends BaseFloorplanViewElement2D {
    constructor(floorplan, options, wall) {
        super(floorplan, options);
        this.__options = options;
        this.__wall = wall;

        this.__frontEdge = null;
        this.__backEdge = null;
        this.__info = new WallDimensions2D(floorplan, options, wall);
        this.viewDimensions = false;

        this.interactive = wall.isLocked;
        this.buttonMode = wall.isLocked;

        if (wall.isLocked) {
            this.__deactivate();
        }

        this.__wallUpdatedEvent = throttle(this.__drawUpdatedWall.bind(this), 100);
        this.__wallDeletedEvent = this.__wallDeleted.bind(this); //this.remove.bind(this);

        this.__wall.addEventListener(EVENT_MOVED, this.__wallUpdatedEvent);
        this.__wall.addEventListener(EVENT_UPDATED, this.__wallUpdatedEvent);
        this.__wall.addEventListener(EVENT_DELETED, this.__wallDeletedEvent);

        if (wall.backEdge) {
            this.__backEdge = new Edge2D(this.__floorplan, options, this.__wall, wall.backEdge);
            this.addChild(this.__backEdge);
        }
        if (wall.frontEdge) {
            this.__frontEdge = new Edge2D(this.__floorplan, options, this.__wall, wall.frontEdge);
            this.addChild(this.__frontEdge);
        }
        this.addChild(this.__info);
        this.__mouseOut();
    }

    get viewDimensions() {
        return (this.__info.alpha > 0.9);
    }

    set viewDimensions(value) {
        if (value) {
            this.__info.alpha = 1.0;
            return;
        }
        this.__info.alpha = 0.0;
    }

    __getCornerCoordinates() {
        let sPoint = Dimensioning.cmToPixelVector2D(this.__wall.start.location.clone());
        let ePoint = Dimensioning.cmToPixelVector2D(this.__wall.end.location.clone());

        // sPoint.x = Dimensioning.cmToPixel(sPoint.x);
        // sPoint.y = Dimensioning.cmToPixel(sPoint.y);
        // ePoint.x = Dimensioning.cmToPixel(ePoint.x);
        // ePoint.y = Dimensioning.cmToPixel(ePoint.y);
        return [sPoint, ePoint];
    }

    __drawInWallItems() {
        if (!this.__wall) return
        this.lineStyle(0, 0xF0F0F0);
        let inWallItems = this.__wall.inWallItems;
        // let depth = this.__wall.thickness * 0.5;
        let wallDirection = this.__wall.wallDirectionNormalized();
        for (let i = 0; i < inWallItems.length; i++) {
            let item = inWallItems[i];
            let pos = new Vector2(item.position.x, item.position.z);
            let width = item.halfSize.x;
            let depth = item.halfSize.z;

            let right = wallDirection.clone().multiplyScalar(width);
            let left = wallDirection.clone().multiplyScalar(width).multiplyScalar(-1);
            let up = wallDirection.clone().rotateAround(new Vector2(), Math.PI * 0.5).multiplyScalar(depth);
            let down = up.clone().multiplyScalar(-1);

            let a = pos.clone().add(right.clone().add(up));
            let b = pos.clone().add(right.clone().sub(up));
            let c = pos.clone().add(left.clone().add(down));
            let d = pos.clone().add(left.clone().sub(down));

            let points = [
                new Point(Dimensioning.cmToPixel(a.x), Dimensioning.cmToPixel(a.y)),
                new Point(Dimensioning.cmToPixel(b.x), Dimensioning.cmToPixel(b.y)),
                new Point(Dimensioning.cmToPixel(c.x), Dimensioning.cmToPixel(c.y)),
                new Point(Dimensioning.cmToPixel(d.x), Dimensioning.cmToPixel(d.y)),
            ];

            this.beginFill(0x0000F0, 1);
            this.drawPolygon(points);
            this.endFill();
        }
    }
    // 绘制入口
    __drawPolygon(color = 0xDDDDDD, alpha = 1.0) {
        this.clear();
        /**
         * Front edge color is blue
         */
        let frontColor = color; //0x0000FF; //

        /**
         * Back Edge color is red
         */
        let backColor = color; //0xFF0000; //
        // console.log(this.wall._walltype, '<<<<<< WallView2D __drawPolygon')

        if (this.__frontEdge) {
            this.__frontEdge.drawEdge(frontColor, alpha);
        }
        if (this.__backEdge) {
            this.__backEdge.drawEdge(backColor, alpha);
        }
        // if(!this.__frontEdge && !this.__backEdge){
        //     console.log('NO FRONT OR BACK EDGE TO DRAW ', this.__wall.wallSize);
        // }
        this.__drawInWallItems();
    }

    __drawBezierWall(color = 0xDDDDDD, alpha = 1.0) {

    }

    __drawSelectedState() {
        // if (this.__frontEdge) {
        //     this.__frontEdge.debugMode = true;
        // }
        // if (this.__backEdge) {
        //     this.__backEdge.debugMode = true;
        // }
        const color  = new Color(this.__options.selectedWallColor).getHex();
        this.__drawPolygon(color, 1.0);
    }
    __drawHoveredOnState() {
        const color  = new Color(this.__options.hoveredWallColor).getHex();
        this.__drawPolygon(color, 1.0);
    }
    __drawHoveredOffState() {
        // if (this.__frontEdge) {
        //     this.__frontEdge.debugMode = false;
        // }
        // if (this.__backEdge) {
        //     this.__backEdge.debugMode = false;
        // }
        this.__drawPolygon(0xA5A7A9, 1.0);
    }

    __getCornerLocation(vec2){
        let s = this.__wall.start.location.clone();
        let e = this.__wall.end.location.clone();
        let vect = e.clone().sub(s);
        let midPoint = s.clone().add(vect.clone().multiplyScalar(0.5));
        let vectorSToMid = s.clone().sub(midPoint);
        let vectorEToMid = e.clone().sub(midPoint);
        let sNewLocation = vec2.clone().add(vectorSToMid);
        let eNewLocation = vec2.clone().add(vectorEToMid);

        return {start: sNewLocation, end: eNewLocation};
    }

    __dragMove(evt) {
        super.__dragMove(evt);


        if (this.__isDragging) {
            let co = evt.data.getLocalPosition(this.parent);
            let cmCo = new Vector2(co.x, co.y);
            cmCo.x = Dimensioning.pixelToCm(cmCo.x);
            cmCo.y = Dimensioning.pixelToCm(cmCo.y);
            if (Configuration.getBooleanValue(snapToGrid) || this.__snapToGrid) {
                cmCo.x = Math.floor(cmCo.x / Configuration.getNumericValue(snapTolerance)) * Configuration.getNumericValue(snapTolerance);
                cmCo.y = Math.floor(cmCo.y / Configuration.getNumericValue(snapTolerance)) * Configuration.getNumericValue(snapTolerance);
            }

            if (Configuration.getBooleanValue(directionalDrag)) {
                let projected = this.__wall.projectOnWallPlane(cmCo);
                let vectorToProjected = cmCo.clone().sub(projected);

                if (Configuration.getBooleanValue(snapToGrid) || this.__snapToGrid) {
                    let snappedLength = Math.floor(vectorToProjected.length() / Configuration.getNumericValue(snapTolerance)) * Configuration.getNumericValue(snapTolerance);
                    vectorToProjected = vectorToProjected.normalize().multiplyScalar(snappedLength);
                }
                let finalCo = this.__wall.location.clone().add(vectorToProjected);
                cmCo = finalCo;
            }

            if (Configuration.getBooleanValue(dragOnlyX) && !Configuration.getBooleanValue(dragOnlyY)) {
                cmCo.y = this.__wall.location.y;
            }

            if (!Configuration.getBooleanValue(dragOnlyX) && Configuration.getBooleanValue(dragOnlyY)) {
                cmCo.x = this.__wall.location.x;
            }

            if(this.__floorplan.boundary){
                if(this.__floorplan.boundary.isValid){
                    let cornerPoints = this.__getCornerLocation(cmCo);
                    if(
                        !this.__floorplan.boundary.containsPoint(cornerPoints.start.x, cornerPoints.start.y) || 
                        !this.__floorplan.boundary.containsPoint(cornerPoints.end.x, cornerPoints.end.y))
                    {
                        return;
                    }
                }
            }

            // this.__wall.move(cmCo.x, cmCo.y);
            this.__wall.location = cmCo; //new Vector2(cmCo.x, cmCo.y);
            evt.stopPropagation();
        }
    }

    __drawUpdatedWall(evt) {
        this.__info.update();
        this.viewDimensions = true;
        if (this.selected) {
            this.__drawSelectedState();
            return;
        }
        this.__drawHoveredOffState();
    }

    __wallDeleted() {
        this.remove();
        this.__wall = null;
    }

    __removeFromFloorplan() {
        this.__wall.remove();
    }

    remove() {
        this.__wall && this.__wall.removeEventListener(EVENT_MOVED, this.__wallUpdatedEvent);
        this.__wall && this.__wall.removeEventListener(EVENT_UPDATED, this.__wallUpdatedEvent);
        this.__wall && this.__wall.removeEventListener(EVENT_DELETED, this.__wallDeletedEvent);
        this.removeChild(this.__info);
        super.remove();
    }

    get wall() {
        return this.__wall;
    }

    get selected() {
        return super.selected;
    }

    set selected(flag) {
        super.selected = flag;
        this.viewDimensions = flag;
    }
}