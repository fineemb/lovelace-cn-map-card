console.info("%c  GAODE MAP CARD  \n%c Version 1.2 ",
"color: orange; font-weight: bold; background: black", 
"color: white; font-weight: bold; background: dimgray");

import 'https://webapi.amap.com/loader.js';
const deps = ['paper-input', 'paper-dropdown-menu', 'paper-item', 'paper-listbox'];
deps.map(dep => {
  if (!customElements.get(dep)) {
    console.log("imported", dep);
    import(`https://unpkg.com/@polymer/${dep}/${dep}.js?module`);
  }
});

const LitElement = Object.getPrototypeOf(
  customElements.get("ha-panel-lovelace")
);
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class GaodeMapCard extends HTMLElement {
  constructor() {
    super();
    this.markers = {};
    this.persons = []; 
    this.fit = 0; 
    this.loaded = false;
    this.loadst = false;
    this.oldentities = []
    this.oldstyle;
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
        <div id="map"></div>
          <paper-icon-button
            id="fitbutton"
            icon="hass:image-filter-center-focus"
            title="Reset focus"
          ></paper-icon-button>
      </div>
    `;
    this.root.appendChild(hacard);
    let fitButton = this.root.querySelector("#fitbutton")
    fitButton.addEventListener('click', () => {
      this.map.setFitView(this.persons, false, [40, 40, 40, 40])
    });
  }
  static getConfigElement() {
    return document.createElement("gaode-map-card-editor");
  }
  static getStubConfig() {
    return {aspect_ratio: '1',
            dark_mode: false,
            entities: ["zone.home"] }
  }
  set hass(hass) {
    this._hass = hass;

    this.entities = this.config.entities; 
    this.card.header=this.config.title

    if(this.loaded){
      if(this.config.entities.length<1){
        return;
      }
      //更新标记点
      var oc = JSON.stringify(this.oldentities)
      var nc = JSON.stringify(this.entities)
      if(oc!=nc){
        //更新标记点
        let ms = []
        Object.values(this.markers).forEach(v => {
          ms.push(v)
        })
        this.map.remove(ms);
        this.markers = {}
        this._loadMap(false,{},hass)
      }else{
        //仅更新位置
        for(var i in this.entities) {
          let entityN = this.entities[i]
          let objstates = hass.states[entityN];
          let gps = [objstates.attributes.longitude, objstates.attributes.latitude];
          const that  = this;
          AMap.convertFrom(gps, 'gps', function (status, result) {
            if (result.info === 'ok' && that.markers[entityN]) {
                that.markers[entityN].moveTo(result.locations[0], {
                  autoRotation: false
              })
            }
          });
        }
      }

      //更新式样
      let newstyle = this.config.dark_mode;
      if(this.oldstyle!=newstyle){
        this.map.setMapStyle("amap://styles/"+(newstyle?'dark':'normal'));
        this.oldstyle = newstyle
      }
      //更新视界
      if(this.fit === this.entities.length){
        this.map.setFitView(this.persons, false, [40, 40, 40, 40])
        this.fit = 0
      }
    }else{
      //首次加载
      if(!this.loadst){
        this.loadst = true;
        setTimeout(() => {
          this._loadMap(true,{
            key: this.config.key||"ce3b1a3a7e67fc75810ce1ba1f83c01a",   // 申请好的Web端开发者Key，首次调用 load 时必填 f87e0c9c4f3e1e78f963075d142979f0
            version: "2.0",   // 指定要加载的 JSAPI 的版本，缺省时默认为 1.4.15
            plugins: ['AMap.MoveAnimation'] //插件列表
          },hass)
        }, 1);
      }
    }
  }
  setConfig(config) {
    this.config = deepClone(config);
    let d = this.root.querySelector("#root")
    d.style.paddingBottom = 100*(this.config.aspect_ratio||1)+"%"
  }
  _loadMap(isInit,config,hass){
    if(typeof AMap != "undefined" && isInit){
      config = {};
    }
    AMapLoader.load(config).then((AMap)=>{
      if(isInit){
        let mapContainer = this.root.querySelector("#map")
        this.map = new AMap.Map(mapContainer,{
          viewMode: '3D',
          // center: [104.937478,35.439575],
          zoom: this.config.default_zoom || 9,
          mapStyle: "amap://styles/"+(this.config.dark_mode?'dark':'normal')
        });
        this.oldstyle = this.config.dark_mode
      }
      let entities = this.entities
      if(entities.length<1){
        this.loaded = true;
        this.oldentities = deepClone(entities)
      }else{
        entities.forEach(function(el,index) {
          let entity = el;
          let hours_to_show =this.config.hours_to_show||0;
          let color = this._colors[index%this._colors.length];
          let domain = entity.split('.')[0]
          let objstates = hass.states[entity];
          let gps = [objstates.attributes.longitude, objstates.attributes.latitude];
          let entityPicture = objstates.attributes.entity_picture || '';
          let entityName =objstates.attributes.friendly_name?objstates.attributes.friendly_name.split(' ').map(function (part) { return part.substr(0, 1); }).join('') : '';
          let markerContent = `<ha-entity-marker width="20" height="20" entity-id="`+entity+`" entity-name="`+entityName+`" entity-picture="`+entityPicture+`" entity-color="`+color+`">
          </ha-entity-marker>`
          const that  = this;
          AMap.convertFrom(gps, 'gps', function (status, result) {
            if (result.info === 'ok') {
              //区域
              new AMap.Circle({
                map: that.map,
                center: result.locations[0],  // 圆心位置
                radius: objstates.attributes.radius || objstates.attributes.gps_accuracy, // 圆半径
                fillColor: domain==='zone'?'rgb(255, 152, 0)':color,   // 圆形填充颜色
                fillOpacity: 0.2,
                strokeColor: domain==='zone'?'rgb(255, 152, 0)':color, // 描边颜色
                strokeWeight: 3, // 描边宽度
              });
              //标记点
              let marker = new AMap.Marker({
                map: that.map,
                position: result.locations[0],
                content: domain==='zone'?`<ha-icon icon="`+objstates.attributes.icon+`"></ha-icon>`:markerContent,
                zIndex: domain==='zone'?100:102,
                anchor: 'center'
              });
              if(domain==='person'){
                that.persons.push(marker);

                //历史路径
                if(isInit && hours_to_show>0){
                  const endTime = new Date();
                  const startTime = new Date();
                  startTime.setHours(endTime.getHours() - hours_to_show);
                  
                  hass.callApi("GET", "history/period/"+startTime.toISOString()+"?filter_entity_id="+entity+"&significant_changes_only=0&end_time="+endTime.toISOString())
                  .then(function(res) {
                    // console.log(res);
                    let arr = res[0]
                    if (arr.length > 1) {
                      var lineArr = []
                      for(var i in arr) {
                        let p = arr[i].attributes;
                        if(p.longitude)lineArr.push([p.longitude,p.latitude]);
                      }

                      AMap.convertFrom(lineArr, 'gps', function (status, result) {
                        if (result.info === 'ok') {
                          var path2 = result.locations;
                          new AMap.Polyline({
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
                            })
                          }

                        }
                      });

                    }
                  })
                }
              }
              that.markers[entity]=marker;
              that.fit++;
              if(that.fit === entities.length)that.loaded = true;
            }
          });
        },this);
      }
      this.oldentities = deepClone(entities)
    }).catch(e => {
        console.log(e);
    })
  }
  _gethistory(){
    this._hass.callApi("GET", "history/period/2020-04-21T08:57:49.634Z?filter_entity_id=person.fineemb&end_time=2020-04-28T08:57:49.634Z")
    .then(function(post) {
      return getJSON(post.commentURL);
    }).then(function funcA(comments) {
      console.log("resolved: ", comments);
    }, function funcB(err){
      console.log("rejected: ", err);
    });
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
      
              .amap-container {
                z-index: 0;
                border: none;
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
              }
      
              paper-icon-button {
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
                width: 100%;
                padding-bottom: 100%;
              }
      
              :host([is-panel]) #root {
                height: 100%;
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
    this.config = deepClone(config);
  }

  static get properties() {
    return {
      hass: {},
      config: {}
    };
  }

  render() {
    var patt = new RegExp("device_tracker|zone|person")
    customElements.get("ha-entity-picker")
    if (!this.hass) {
      return html``;
    }
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
          <ha-switch
            ?checked="${this.config.dark_mode !== false}"
            .configValue="${"dark_mode"}"
            @change="${this._valueChanged}"
            >${this.hass.localize("ui.panel.lovelace.editor.card.map.dark_mode")}</ha-switch>
          <paper-input
            label="${this.hass.localize("ui.panel.lovelace.editor.card.map.hours_to_show")} (${this.hass.localize("ui.panel.lovelace.editor.card.config.optional")})"
            type="number"
            .value="${this.config.hours_to_show}"
            .configValue="${"hours_to_show"}"
            @change="${this._valueChanged}"
          ></paper-input>
        </div>
        <h3>${this.hass.localize("ui.panel.lovelace.editor.card.generic.entities")} (${this.hass.localize("ui.panel.lovelace.editor.card.config.optional")})
        </h3>
        <div class="entities">
          ${this.config.entities.map(entity =>  html`
            <paper-input-container >
              <ha-icon icon="${this.hass.states[entity].attributes.icon || 'mdi:home'}" slot="prefix"></ha-icon>
              <input type="text" value="${entity}" slot="input" list="browsers" autocapitalize="none" @change="${this._changeEntity}">
              <paper-icon-button slot="suffix" icon="mdi:close" title="${this.hass.localize("ui.panel.lovelace.editor.card.map.delete")}" @click=${this._delEntity}></paper-icon-button>
              <datalist id="browsers">
                    ${Object.keys(this.hass.states).filter(a => patt.test(a) ).map(entId => html`
                        <option value=${entId}>${this.hass.states[entId].attributes.friendly_name || entId}</option>
                      `)}
              </datalist>
            </paper-input-container>
            
            `
          )}
        </div>

        <paper-input-container >
          <ha-icon icon="mdi:home" slot="prefix"></ha-icon>
          <input type="text" value="" slot="input" list="browsers" autocapitalize="none" @change="">
          <paper-icon-button slot="suffix" icon="mdi:plus" title="${this.hass.localize("ui.dialogs.helper_settings.input_select.add")}" @click=${this._addEntity}></paper-icon-button>
          <datalist id="browsers">
                ${Object.keys(this.hass.states).filter(a => patt.test(a) ).map(entId => html`
                    <option value=${entId}>${this.hass.states[entId].attributes.friendly_name || entId}</option>
                  `)}
          </datalist>
        </paper-input-container>
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
    const target = ev.target.previousElementSibling;
    if (!this.config || !this.hass ) {
      return;
    }
    const entities = this.config.entities
    let flag = true;
    entities.forEach(item=>{
      if(target.value===item){ 
        flag = false;
      }
    })
    if(flag){
      entities.push(target.value)
      this.config = {
        ...this.config,
        "entities": entities
      };
      this.configChanged(this.config)
      target.value = ''
    }

  }
  _changeEntity(ev){
    const target = ev.target;
    if (!this.config || !this.hass ) {
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
}

customElements.define("gaode-map-card-editor", GaodeMapCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "gaode-map-card",
  name: "地图(中国)",
  preview: true, // Optional - defaults to false
  description: "高德地图" // Optional
});
