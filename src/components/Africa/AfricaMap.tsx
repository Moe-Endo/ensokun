import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { geoMercator } from 'd3-geo';
import LineComponent from '../LineComponent'; 
import LabelComponent from '../LabelComponent';
import HNDMarker from '../HNDMarker';
import Modal from '../Modal';
import { getImageForRoute } from './getImageForRoute'; 
import enso from '../../img/enso/enso ver3.png';  
import airportNames from './airportNames';
import MovingImage from '../MovingImage';

interface Airport {
  iata_code: string;
  airport_name: string;
  country_name: string;
  latitude: number;
  longitude: number;
}

interface AfricaMapProps {
  setTotalLabelSum: (sum: number) => void; // 親から受け取る関数
}

const geoUrl = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson";

const safeProjection = (projection: (coords: [number, number]) => [number, number] | null) => {
  return (coords: [number, number]): [number, number] => {
    const projected = projection(coords);
    if (projected) {
      return projected;
    }
    return [0, 0]; // デフォルト値
  };
};

const AfricaMap: React.FC<AfricaMapProps> = ({ setTotalLabelSum }) => {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [selectedAirports, setSelectedAirports] = useState<string[]>(['HND']); // HNDを初期選択
  const [availableAirports, setAvailableAirports] = useState<string[]>([]); // クリック可能な空港
  const [selectedConnections, setSelectedConnections] = useState<{from: string, to: string, label: string}[]>([]); // 選択された接続を保存
  const [Goal, setGoal] = useState<boolean>(false); // ゲーム終了フラグ
  const [totalLocalLabelSum, setTotalLocalLabelSum] = useState<number>(0); // ローカルの総ラベルの合計
  const [clickedAirportCoords, setClickedAirportCoords] = useState<[number, number] | null>(null); // 最後にクリックされた空港の座標
  const [currentImageSrc, setCurrentImageSrc] = useState<string>(enso); // 現在表示している画像の状態
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchAirports = async () => {
      // https://aviationstack.com/ を使用して空港APIを取得
      try {
        const response = await axios.get('https://api.aviationstack.com/v1/airports', {
          params: {
            access_key: 'd4c2df5baa3fff5746d798f6577a67bf', //API KEY　ここを変える
          }
        });

        setAirports(response.data.data);

        // 初期状態でHNDと接続されている空港をavailableAirportsに追加
        setAvailableAirports(['ABM', 'ABU', 'AEG', 'ACJ', 'ACZ']);
      } catch (error) {
        console.error('Error fetching airport data:', error);
      }
    };

    fetchAirports();
  }, []);

  const projection = safeProjection(
    geoMercator()
      .scale(350)
      .center([-55, -4])
      .rotate([240, 0, 0])
  );

  const getAdjustedCoords = (
    coords: [number, number],
    projection: (coords: [number, number]) => [number, number],
    xOffset: number = -80,
    yOffset: number = 50
  ) => {
    const [x, y] = projection(coords);
    return [x + xOffset, y + yOffset];
  };

    // 空港間の接続を定義（赤線で繋がる空港ペアとラベル）
  const connections = [
    ['HND', 'ABM', '6'], ['HND', 'ABU', '6'], ['HND', 'AEG', '6'], ['HND', 'ACJ', '7'],
    ['HND', 'ACZ', '12'], ['ACZ', 'AAE', '7'], ['ACZ', 'ABK', '5'], ['ABM', 'ABU', '12'],  
    ['ABU', 'AEG', '6'], ['AEG', 'ACJ', '12'], ['ACJ', 'ABK', '8'], ['ABK', 'AAE', '25'],  
    ['ABM', 'AFD', '40'], ['ABU', 'AFD', '35'], ['AEG', 'AFD', '30'], ['ACJ', 'AFD', '30'],
    ['ABK', 'AFD', '25'], ['AAE', 'AFD', '35'] 
  ];

  const hndAirport: Airport = {
    iata_code: 'HND',
    airport_name: 'Tokyo Haneda Airport',
    country_name: 'Japan',
    latitude: 35.6895,
    longitude: 139.6917
  };

  // フィルタリングされた空港のリストを取得
  const filteredAirports = airports.filter(airport =>
    ['ACZ', 'AAE', 'ABM', 'ABU', 'AEG', 'ACJ', 'ABK', 'AFD'].includes(airport.iata_code)
  );

  // 空港をクリックした際の処理
  const handleMarkerClick = (iataCode: string, longitude: number, latitude: number) => {
    if (availableAirports.includes(iataCode) && !Goal) {
      // 空港を選択済みに追加
      setSelectedAirports((prev) => [...prev, iataCode]);

       // 最後に選択された空港
      const lastSelectedAirport = selectedAirports[selectedAirports.length - 1];

      // 接続情報を取得
      const connection = connections.find(([a1, a2]) => (a1 === lastSelectedAirport && a2 === iataCode) || (a1 === iataCode && a2 === lastSelectedAirport));

      if (connection) {
        // 接続を保存（from, to, label）
        setSelectedConnections((prev) => [...prev, {from: lastSelectedAirport, to: iataCode, label: connection[2]}]);

        // ラベルの合計を計算
        setTotalLocalLabelSum(prev => {  
          const newSum = prev + Number(connection[2]);
          setTotalLabelSum(newSum); // 親コンポーネントに更新を通知
          return newSum;
        });

        // クリックした空港の座標を保存し、ピクセル座標に変換
        const pixelCoords = projection([longitude, latitude]);
        if (pixelCoords) {
          setClickedAirportCoords(pixelCoords);
        }

        // 経路に基づいて画像を切り替える(getImageForRoute.tsで指定)
        setCurrentImageSrc(getImageForRoute(lastSelectedAirport, iataCode));
      }

      // 新たにクリック可能な空港を計算
      const nextAirports = connections
        .filter(([a1, a2]) => a1 === iataCode || a2 === iataCode)
        .map(([a1, a2]) => (a1 === iataCode ? a2 : a1))
        .filter((airport) => !selectedAirports.includes(airport));

      setAvailableAirports(nextAirports);

         // ゴールの AFD に到達した場合、ゲーム終了
      if (iataCode === 'AFD') {
        setGoal(true);
        setIsModalOpen(true); 
      }
    }
  };

  // リセット処理を定義
  const handleReset = () => {
    setSelectedAirports(['HND']); // 初期状態に戻す（HNDのみ選択）
    setSelectedConnections([]);  // 選択された接続をリセット
    setAvailableAirports(['ABM', 'ABU', 'AEG', 'ACJ', 'ACZ']); // 初期状態に戻す
    setTotalLabelSum(0);  // 総ラベルをリセット
    setGoal(false);  // ゲーム終了フラグをリセット
    setIsModalOpen(false);  // モーダルを閉じる
    setCurrentImageSrc(enso); // 画像を初期状態に戻す
    setTotalLocalLabelSum(0); // リセット時に親にも通知
  };

  const renderLines = () => {
    return connections.map(([a1, a2], index) => {
      const airport1 = a1 === 'HND' ? hndAirport : airports.find(airport => airport.iata_code === a1);
      const airport2 = a2 === 'HND' ? hndAirport : airports.find(airport => airport.iata_code === a2);
      if (airport1 && airport2) {
         // この接続が選択されているかどうかを判定
         const isSelectedConnection = selectedConnections.some(
          connection => (connection.from === a1 && connection.to === a2) || (connection.from === a2 && connection.to === a1)
        );
        const [x1, y1] = getAdjustedCoords([airport1.longitude, airport1.latitude], projection);
        const [x2, y2] = getAdjustedCoords([airport2.longitude, airport2.latitude], projection);
        
        return (
          <LineComponent
            key={`line-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            color={isSelectedConnection ? "#0000FF" : "#FF0000"} // 選択されたら青色、それ以外は赤色
            strokeDasharray={isSelectedConnection ? "0" : "4 2"} // 選択されたら実線、それ以外は点線
          />
        );
      }
      return null;
    });
  };
  
  const renderLabels = () => {
    return connections.map(([a1, a2, label], index) => {
      const airport1 = a1 === 'HND' ? hndAirport : airports.find(airport => airport.iata_code === a1);
      const airport2 = a2 === 'HND' ? hndAirport : airports.find(airport => airport.iata_code === a2);
      if (airport1 && airport2) {
        const [x1, y1] = getAdjustedCoords([airport1.longitude, airport1.latitude], projection);
        const [x2, y2] = getAdjustedCoords([airport2.longitude, airport2.latitude], projection);
        const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
  
        return (
          <LabelComponent
            key={`label-${index}`}
            x={mx}
            y={my}
            label={label}
            labelColor="#0000FF" // customize as needed
            labelSize="1.5em"
          />
        );
      }
      return null;
    });
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 350,
          center: [-55, -4],
          rotate: [240, 0, 0]
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map(geo => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                style={{
                  default: {
                    fill: "#3CB371",
                    stroke: "#FFFFFF",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                  hover: {
                    fill: "#3CB371",
                    stroke: "#FFFFFF",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                  pressed: {
                    fill: "#3CB371",
                    stroke: "#FFFFFF",
                    strokeWidth: 0.5,
                    outline: "none",
                  },
                }}
              />
            ))
          }
        </Geographies>

         {/* 空港間の線を描画 */}
        {renderLines()}

         {/* 羽田空港のマーカーを表示 */}
        <HNDMarker
          longitude={hndAirport.longitude}
          latitude={hndAirport.latitude}
          selectedAirports={selectedAirports}
          handleMarkerClick={() => handleMarkerClick(hndAirport.iata_code, hndAirport.longitude, hndAirport.latitude)}
        />

         {/* フィルタリングされた空港の赤丸 */}
        {filteredAirports.map((airport) => (
          <Marker
            key={airport.iata_code}
            coordinates={[airport.longitude, airport.latitude]}
          >
            <circle
              r={8}
              fill={
                airport.iata_code === 'AFD' 
                ? selectedAirports.includes(airport.iata_code) 
                  ? "#0000FF" // AFDが選択されたら青色
                  : "#FFA500" // AFDが未選択ならオレンジ色
                : selectedAirports.includes(airport.iata_code) 
                ? "#0000FF" // 他の空港が選択されたら青色
                : "#FF0000" // 他の空港が未選択なら赤色
              }
              onClick={() => handleMarkerClick(airport.iata_code, airport.longitude, airport.latitude)}
              style={{ cursor: availableAirports.includes(airport.iata_code) ? "pointer" : "not-allowed" }}
            />
            <text
              textAnchor="middle"
              style={{ fontFamily: "system-ui", fill: "#000000", fontSize: "0.8em", fontWeight: "bold" }}
              y={-10}
            >
              {airportNames[airport.iata_code] || airport.iata_code}
            </text>
          </Marker>
        ))}

        {/* ラベルを描画 */}
{renderLabels()}

        {/* ensoの移動*/}
        <MovingImage 
          imageSrc={currentImageSrc} 
          clickedAirportCoords={clickedAirportCoords} 
          projection={projection} 
        />
      </ComposableMap>

      <Modal isOpen={isModalOpen} onClose={handleReset} totalLabelSum={totalLocalLabelSum} isWinner={totalLocalLabelSum === 36}/>
    </div>
  );
};

export default AfricaMap;