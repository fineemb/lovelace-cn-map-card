console.info("%c  GAODE MAP CARD  \n%c Version 1.2.5 ",
"color: orange; font-weight: bold; background: black", 
"color: white; font-weight: bold; background: dimgray");


import 'https://webapi.amap.com/loader.js';
import './w3color.js';
import 'https://unpkg.com/@material/mwc-radio@0.18.0/mwc-radio.js?module';


// customElements.get("hui-entity-editor")

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;
const includeDomains = ["device_tracker","person"];
class GaodeMapCard extends HTMLElement {
  constructor() {
    super();
    this.markers = {};
    this.paths = {};
    this.persons = []; 
    this.fit = 0; 
    this.trace = false;
    this.historyPath = {};
    this.loaded = false;
    this.loadst = false;
    
    this.oldentities = [];
    this.old_mode;
    this.theme;
    this.positions = {};
    this._colors = [
      "#0288D1",
      "#00AA00",
      "#984ea3",
      "#00d2d5",
      "#ff7f00",
      "#af8d00",
      "#7f80cd",
      "#b3e900",
      "#c42e60",
      "#a65628",
      "#f781bf",
      "#8dd3c7",
    ];

    this.root = this.attachShadow({ mode: 'open' });
    if (this.root.lastChild) this.root.removeChild(root.lastChild);
    const style = document.createElement('style');
    style.textContent = this._cssData();
    this.root.appendChild(style);
    const hacard = document.createElement('ha-card');
    this.card = hacard;
    hacard.className = 'gaode-map-card';
    hacard.innerHTML = `
    <div id="root">
      <div id="map">
        <div id="container"></div>
        <ha-icon-button id="fitbutton" icon="hass:image-filter-center-focus" title="Reset focus" role="button" tabindex="0" aria-disabled="false"></ha-icon-button>
      </div>
  </div>
    `;
    this.root.appendChild(hacard);
    let fitButton = this.root.querySelector("#fitbutton")
    fitButton.addEventListener('click', () => {
      if(this.trace){
        this.trace=false
        this.root.querySelector("#fitbutton").classList.remove("active")
        this.map.setPitch(0)
      }else{
        this.trace=true
        this.root.querySelector("#fitbutton").classList.add("active")
        this.map.setPitch(80)
      }
    });
  }
  static getConfigElement() {
    return document.createElement("gaode-map-card-editor");
  }
  static getStubConfig() {
    return {aspect_ratio: '1',
            dark_mode: "auto",
            traffic: false,
            entities: ["zone.home"] }
  }
  set isPanel(isPanel){ 	
    this._isPanel = isPanel;
  }
  
  set editMode(editMode){ 	
    this._editMode  = editMode ;
  }

  set hass(hass) {
    this._hass = hass;
    this.entities = this.config.entities; 
    this.card.header=this.config.title

    if(this._isPanel){
      this.root.querySelector("#root").style.paddingBottom = 0
      this.setAttribute("is-panel","")
    }
    if(this.loaded){
      if(this.config.entities.length<1){
        return;
      }

      var oc = JSON.stringify(this.oldentities);
      var nc = JSON.stringify(this.entities);
      if(oc!=nc){
        //更新标记点
        this.map.clearMap();
        this.markers = {};
        this.paths = {};
        this.historyPath = {};
        this.entities.forEach(function(entity,index) {
          let entityt = typeof entity === "string"?entity:entity.entity;
          let type = entity.type?entity.type:"gps";
          this._addMarker(entityt,index,type);
        },this);
        this.oldentities = deepClone(this.entities);
      }else{
        //仅更新位置
        for(var i in this.entities) {
          let entityt = typeof this.entities[i] === "string"?this.entities[i]:this.entities[i].entity;
          let type = this.entities[i].type?this.entities[i].type:"gps";
          this._updateMarker(entityt,type);
        }
        //实时追踪
        if(this.trace){
          let angle = this.config.angle?hass.states[this.config.angle].state:0;
          if(angle)this.map.setRotation(360-angle);
          this.map.setFitView(this.persons, false, [40, 40, 40, 40]);
        }

      }

      //更新式样
      let dark_mode = this.config.dark_mode;
      let newTheme = hass.themes.default_theme;
      let style = dark_mode;
      
      if(this.old_mode!=dark_mode){
        if(dark_mode!="auto"){
          this.map.setMapStyle("amap://styles/"+style);
          this.root.querySelector("#map").className = style;
          this.old_mode = dark_mode;
        }else{
          let cardColor = hass.themes.themes[newTheme]["card-background-color"];
          let lightness = cardColor?w3color(cardColor).lightness:1
          let colorDark = lightness<0.5?true:false
          style = colorDark?'dark':'normal'
          this.map.setMapStyle("amap://styles/"+style);
          this.root.querySelector("#map").className = style
          this.old_mode = dark_mode
          this.theme=hass.themes.default_theme
        }
      }
      if(dark_mode==="auto"){
        if(this.theme!=newTheme){
          let cardColor = hass.themes.themes[newTheme]["card-background-color"];
          let lightness = cardColor?w3color(cardColor).lightness:1
          let colorDark = lightness<0.5?true:false
          style = colorDark?'dark':'normal'
          this.map.setMapStyle("amap://styles/"+style);
          this.root.querySelector("#map").className = style
          this.old_mode = dark_mode
          this.theme=hass.themes.default_theme
        }
      }
      //实时路况图层
      if(this.config.traffic){
        this.trafficLayer.show();
      }else{
        this.trafficLayer.hide();
      }
      //更新视界
      // console.info(this.fit)
      if(this.fit >= this.entities.length){
        this.map.setFitView(this.persons, false, [40, 40, 40, 40])
        this.fit = 0
      }
    }else{
      //首次加载
      if(!this.loadst){
        this.loadst = true;
        setTimeout(() => {
          this._loadMap({
            key: this.config.key||"ce3b1a3a7e67fc75810ce1ba1f83c01a",   // 申请好的Web端开发者Key，首次调用 load 时必填 f87e0c9c4f3e1e78f963075d142979f0
            version: "2.0",   // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
            plugins: ['AMap.MoveAnimation'] //插件列表
          })
        }, 100);
      }
    }
  }
  setConfig(config) {
    this.config = deepClone(config);
    let d = this.root.querySelector("#root")
    d.style.paddingBottom = 100*(this.config.aspect_ratio||1)+"%"
  }
  _loadMap(config){
    if(!this._hass.config.longitude)return
    AMapLoader.load(config).then(()=>{
      let mapContainer = this.root.querySelector("#container")
      this.map = new AMap.Map(mapContainer,{
        viewMode: '3D',
        center:[this._hass.config.longitude,this._hass.config.latitude],
        zoom: this.config.default_zoom || 9
      });
      let mode = this.config.dark_mode
      let style
      if(mode==="auto"){
        style = "normal"
      }else{
        style = mode;
      }
      this.old_mode = mode
      this.map.setMapStyle("amap://styles/"+style);
      this.root.querySelector("#map").className = style
      
      //实时路况图层
      this.trafficLayer = new AMap.TileLayer.Traffic({
        zIndex: 10
      });
      this.trafficLayer.setMap(this.map);
      this.loaded = true;
    }).catch(e => {
        console.log(e);
    })
  }
  _updateMarker(entity,type){
    let objstates = this._hass.states[entity];
    if(!objstates || !objstates.attributes.longitude){
      return
    } 
    let gps = [objstates.attributes.longitude, objstates.attributes.latitude];
    let hours_to_show =this.config.hours_to_show||0;
    let newLngLat = new AMap.LngLat(gps[0],gps[1])
    let oldLngLat = new AMap.LngLat(gps[0],gps[1])
    if(this.positions[entity]){
      let oldGPS = this.positions[entity]
      oldLngLat = new AMap.LngLat(oldGPS[0],oldGPS[1])
    }
    let distance = newLngLat.distance(oldLngLat)

    // 过滤太小的距离
    // console.log(distance);
    if(distance>5){
      const that  = this;
      AMap.convertFrom(gps, type, function (status, result) {
        if (result.info === 'ok' && that.markers[entity]) {
          that.markers[entity].moveTo(result.locations[0], {
              autoRotation: false
          })
          if(hours_to_show>0 && that.trace){
            that._gethistory(hours_to_show, entity, "")
          }
        }
      });
    }
    this.positions[entity] = gps;
  }
  _addMarker(entity,index,type){
    
    let color = this._colors[index%this._colors.length];
    let objstates = this._hass.states[entity];
    if(!objstates || !objstates.attributes.longitude){
      this.fit++;
      return
    } 
    let gps = new AMap.LngLat(objstates.attributes.longitude, objstates.attributes.latitude);
    let that = this;
    if(type=='gaode'){
      that._showMarker(gps,entity,color,type);
    }else{
      AMap.convertFrom(gps, type, function (status, result) {
        console.info(status)
        if (result.info === 'ok') {
          that._showMarker(result.locations[0],entity,color,type);
        }
      });
    }
  }

  _showMarker(result,entity,color,type){
    
    let domain = entity.split('.')[0];
    let hours_to_show =this.config.hours_to_show||0;
    let objstates = this._hass.states[entity];
    let entityPicture = objstates.attributes.entity_picture || '';
    let entityName =objstates.attributes.friendly_name?objstates.attributes.friendly_name.split(' ').map(function (part) { return part.substr(0, 1); }).join('') : '';
    let markerContent = `<ha-entity-marker width="20" height="20" entity-id="`+entity+`" entity-name="`+entityName+`" entity-picture="`+entityPicture+`" entity-color="`+color+`"></ha-entity-marker>`

    //区域
    var circle = new AMap.Circle({
      center: result,  // 圆心位置
      radius: objstates.attributes.radius || objstates.attributes.gps_accuracy, // 圆半径
      fillColor: domain==='zone'?'rgb(255, 152, 0)':color,   // 圆形填充颜色
      fillOpacity: 0.2,
      zIndex: 101,
      strokeColor: domain==='zone'?'rgb(255, 152, 0)':color, // 描边颜色
      strokeWeight: 3, // 描边宽度
    });
    this.map.add(circle);
    
    //标记点
    let marker = new AMap.Marker({
      map: this.map,
      position: result,
      content: domain==='zone'?`<ha-icon icon="`+objstates.attributes.icon+`"></ha-icon>`:markerContent,
      zIndex: domain==='zone'?102:103,
      anchor: 'center'
    });
    if(domain==='person'||domain==='device_tracker'){
      this.persons.push(marker);
      //历史路径
      if(hours_to_show>0){
        this._gethistory(hours_to_show, entity, color, type)
      }
    }
    this.markers[entity] = marker;
    this.fit++;
    if(this.fit === this.entities.length)this.loaded = true;
  }
  
  _gethistory(hours, entity, color, type){
    const endTime = new Date();
    const startTime = new Date();
    startTime.setHours(endTime.getHours() - hours);
    
    const that  = this;
    this._hass.callApi("GET", "history/period/"+startTime.toISOString()+"?filter_entity_id="+entity+"&significant_changes_only=0&end_time="+endTime.toISOString())
    .then(function(res) {
      let arr = res[0]

      if (arr.length > 1 && that.historyPath[entity] != arr.length) {
        that.historyPath[entity] = arr.length;
        var lineArr = []
        for(var i in arr) {
          let p = arr[i].attributes;
          if(p.longitude)lineArr.push(new AMap.LngLat(p.longitude,p.latitude));
        }

        if(type=='gaode'){
          var path2 = lineArr;
          if( that.paths[entity]){
            that.paths[entity].setPath(path2);
          }else{
            that.paths[entity] = new AMap.Polyline({
              map: that.map,
              path: path2,  
              zIndex: 200,
              strokeWeight: 3, 
              strokeColor: color, 
              strokeOpacity: 0.5,
              lineJoin: 'round' 
            });

            for(var i=0;i<path2.length;i+=1){
              var center = path2[i];
              new AMap.CircleMarker({
                map: that.map,
                center:center,
                strokeWeight:0,
                radius:4,
                fillColor:color,
                fillOpacity:0.5,
                zIndex:200,
                bubble:true
              });
            }
          }
        }else{
          AMap.convertFrom(lineArr, type, function (status, result) {
            if (result.info === 'ok') {
              var path2 = result.locations;
              if( that.paths[entity]){
                that.paths[entity].setPath(path2);
              }else{
                that.paths[entity] = new AMap.Polyline({
                  map: that.map,
                  path: path2,  
                  zIndex: 200,
                  strokeWeight: 3, 
                  strokeColor: color, 
                  strokeOpacity: 0.5,
                  lineJoin: 'round' 
                });
    
                for(var i=0;i<path2.length;i+=1){
                  var center = path2[i];
                  new AMap.CircleMarker({
                    map: that.map,
                    center:center,
                    strokeWeight:0,
                    radius:4,
                    fillColor:color,
                    fillOpacity:0.5,
                    zIndex:200,
                    bubble:true
                  });
                }
              }
  
            }
          });
        }

      }
    })
  }
  _cssData(){
    var css = `
            :host([is-panel]) ha-card {
                left: 0;
                top: 0;
                width: 100%;
                /**
                 * In panel mode we want a full height map. Since parent #view
                 * only sets min-height, we need absolute positioning here
                 */
                height: 100%;
                position: absolute;
              }
      
              ha-card {
                overflow: hidden;
                
              }
              #map {
                z-index: 0;
                border: none;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: inherit;
              }

              .amap-container {
                z-index: 0;
                border: none;
                position: relative;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
              }
      
              .amap-logo{
                position: absolute;
                bottom: 0;
                left: 10px;
              }
              .amap-marker ha-icon{
                position: absolute;
                bottom: calc(50% - 12px);
                left: calc(50% - 12px);
              }

              ha-icon-button {
                position: absolute;
                top: 7px;
                left: 7px;
              }
              ha-entity-marker {
                height: 24px!important;
                width: 24px!important;
              }
              
              #root {
                position: relative;
              }
              #container > iframe{
                visibility: hidden;
              }
              :host([is-panel]) #root {
                height: 100%;
              }
              .normal #fitbutton {
                color:#000;
              }
              .dark #fitbutton {
                color:#fff;
              }
              #fitbutton.active {
                color:var(--paper-item-icon-active-color);
              }
    `
    return css;
  }
}

function deepClone(value) {
  if (!(!!value && typeof value == 'object')) {
    return value;
  }
  if (Object.prototype.toString.call(value) == '[object Date]') {
    return new Date(value.getTime());
  }
  if (Array.isArray(value)) {
    return value.map(deepClone);
  }
  var result = {};
  Object.keys(value).forEach(
    function(key) { result[key] = deepClone(value[key]); });
  return result;
}
customElements.define("gaode-map-card", GaodeMapCard);

export class GaodeMapCardEditor extends LitElement {

  setConfig(config) {
    const preloadCard = type => window.loadCardHelpers()
      .then(({ createCardElement }) => createCardElement({type}))
    preloadCard({type:'entities',entities:config.entities});
    customElements.get("hui-entities-card").getConfigElement()

    this.config = deepClone(config);
    this._configEntities = config.entities
      ? this._processEditorEntities(config.entities)
      : [];
  }

  static get properties() {
    return {
      hass: {},
      config: {}
    };
  }

  render() {
    var patt = new RegExp("device_tracker|zone|person")
    if (!this.hass) {
      return html``;
    }

    let dark_mode = this.config.dark_mode
    return html`
      <div class="card-config">
        <paper-input
          label="${this.hass.localize("ui.panel.lovelace.editor.card.generic.title")} (${this.hass.localize("ui.panel.lovelace.editor.card.config.optional")})"
          .value="${this.config.title}"
          .configValue="${"title"}"
          @value-changed="${this._valueChanged}"
        ></paper-input>
        <div class="side-by-side">
          <paper-input
            label="${this.hass.localize("ui.panel.lovelace.editor.card.generic.aspect_ratio")} (${this.hass.localize("ui.panel.lovelace.editor.card.config.optional")})"
            .value="${this.config.aspect_ratio}"
            .configValue="${"aspect_ratio"}"
            @value-changed="${this._valueChanged}"
          ></paper-input>
          <paper-input
            label="${this.hass.localize("ui.panel.lovelace.editor.card.map.default_zoom")} (${this.hass.localize("ui.panel.lovelace.editor.card.config.optional")})"
            type="number"
            .value="${this.config.default_zoom}"
            .configValue="${"default_zoom"}"
            @value-changed="${this._valueChanged}"
          ></paper-input>
        </div>
        <div class="side-by-side">
          <mwc-formfield label="实时路况">
            <ha-switch
              ?checked="${this.config.traffic !== false}"
              .configValue="${"traffic"}"
              @change="${this._valueChanged}"
              ></ha-switch>
              
          </mwc-formfield>
          <paper-input
            label="${this.hass.localize("ui.panel.lovelace.editor.card.map.hours_to_show")} (${this.hass.localize("ui.panel.lovelace.editor.card.config.optional")})"
            type="number"
            .value="${this.config.hours_to_show}"
            .configValue="${"hours_to_show"}"
            @change="${this._valueChanged}"
          ></paper-input>
        </div>
        <div class="side-by-side">
          <mwc-formfield label="白天模式">
              <mwc-radio id="b1" ?checked=${(dark_mode==='normal')} value="normal" name="style_mode" .configValue="${"dark_mode"}" @change="${this._valueChanged}"></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="夜间模式">
              <mwc-radio id="b2" ?checked=${(dark_mode==='dark')} value="dark" name="style_mode" .configValue="${"dark_mode"}" @change="${this._valueChanged}"></mwc-radio>
          </mwc-formfield>
          <mwc-formfield label="跟随主题">
              <mwc-radio id="b3" ?checked=${(dark_mode==='auto')} value="auto" name="style_mode" .configValue="${"dark_mode"}" @change="${this._valueChanged}"></mwc-radio>
          </mwc-formfield>
        </div>

        <hui-entity-editor
          .hass="${this.hass}"
          .entities="${this._configEntities}"
          .includeDomains=${includeDomains}
          @entities-changed="${this._entitiesValueChanged}"
        ></hui-entity-editor>

        <h3>API KEY
        <a href="//lbs.amap.com/dev/id/newuser" class="" target="_blank">获取KEY</a>
        </h3>
        <div class="gaode_key">
          <paper-input
            label="${this.hass.localize("component.airvisual.config.step.user.data.api_key")}"
            .value="${this.config.key}"
            .configValue="${"key"}"
            @value-changed="${this._valueChanged}"
          ></paper-input>
        </div>
      </div>
      <datalist id="browsers">
      ${Object.keys(this.hass.states).filter(a => patt.test(a) ).map(entId => html`
          <option value=${entId}>${this.hass.states[entId].attributes.friendly_name || entId}</option>
        `)}
      </datalist>
    `;
  }
  static get styles() {
    return css `
    a{
      color: var(--accent-color);
    }
    .side-by-side {
      display: flex;
    }
    .side-by-side > * {
      flex: 1;
      padding-right: 4px;
    }
    ha-switch{
      margin-right: 10px;
    }
    .entities > * {
      width: 100%;
      padding-right: 4px;

    }
    paper-dropdown-menu{
      width: 100%;
      padding-right: 4px;
    }
    paper-input-container ha-icon{
      margin-right: 10px;
    }
    `
  }
  _focusEntity(e){
    e.target.value = ''
  }
  _delEntity(ev){
    const target = ev.target.previousElementSibling;
    if (!this.config || !this.hass ) {
      return;
    }
    const entities = this.config.entities
    let id = -1 ;
    for (var i=0; i < entities.length ; ++i){
      if(entities[i]===target.value){
        id = i
      }
    }
    if(id>-1)entities.splice(id, 1);
    this.configChanged(this.config)

  }
  _addEntity(ev){
    const target = ev.target.value || ev.target.previousElementSibling.value;
    if (!this.config || !this.hass || !target) {
      return;
    }
    const entities = this.config.entities
    let flag = true;
    entities.forEach(item=>{
      if(target===item){ 
        flag = false;
        ev.target.value = ''
      }
    })
    if(flag){
      entities.push(target)
      this.config = {
        ...this.config,
        "entities": entities
      };
      this.configChanged(this.config)
      ev.target.value = ''
    }

  }
  _changeEntity(ev){
    const target = ev.target;
    if (!this.config || !this.hass || !target) {
      return;
    }
    const entities = this.config.entities
    let id = -1 ;
    for (var i=0; i < entities.length ; ++i){
      if(entities[i]===target.defaultValue){
        id = i
      }
    }
    if(id>-1){
      delete entities[id];
      entities[id] = target.value
    }
    this.configChanged(this.config)
  }
  _entitiesValueChanged(ev){
    if (!this.config || !this.hass) {
      return;
    }
    if (ev.detail && ev.detail.entities) {
      this.config = { ...this.config, entities: ev.detail.entities };

      this._configEntities = this._processEditorEntities(this.config.entities);
      this.configChanged(this.config)
    }
  }

  _valueChanged(ev) {
    if (!this.config || !this.hass) {
      return;
    }
    const target = ev.target;
    if (this.config[`${target.configValue}`] === (target.value||target.__checked)) {
      return;
    }
    if (target.configValue) {
      if (target.value === "") {
        delete this.config[target.configValue];
      } else {
        this.config = {
          ...this.config,
          [target.configValue]: target.value||target.__checked
        };
      }
    }
    this.configChanged(this.config)
    // fireEvent(this, "config-changed", { config: this.config });
  }

  configChanged(newConfig) {
    const event = new Event("config-changed", {
      bubbles: true,
      composed: true
    });
    event.detail = {config: newConfig};
    this.dispatchEvent(event);
  }
  _processEditorEntities(entities) {
    return entities.map((entityConf) => {
      if (typeof entityConf === "string") {
        return { entity: entityConf };
      }
      return entityConf;
    });
  }
}

customElements.define("gaode-map-card-editor", GaodeMapCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "gaode-map-card",
  name: "地图(中国)",
  preview: true, // Optional - defaults to false
  description: "高德地图" // Optional
});
