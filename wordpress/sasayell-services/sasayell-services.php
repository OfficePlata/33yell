<?php
/**
 * Plugin Name: ささエール サービスページ
 * Description: /sasayell/?service=yatoeiru|manaberu|makaseru|shiraberu|shindan で各サービスページを表示します。テーマのCSS・ヘッダー・フッターは読み込みません。
 * Version: 1.3.0
 * Author: Office Plata
 * Requires at least: 5.5
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// ささエールトップの固定ページスラッグ（sasayell-lp と同じ）
define( 'SASAYELL_SERVICES_PARENT_SLUG', 'sasayell' );
define( 'SASAYELL_SERVICES_PARAM', 'service' );

/**
 * 表示できるサービス一覧。
 * file: html/ 内の1枚HTML / page: 既存の固定ページ（本文をそのまま表示）
 */
function sasayell_services_map() {
	return array(
		'yatoeiru'  => array( 'file' => 'yatoeiru.html' ),
		'manaberu'  => array( 'file' => 'manaberu.html' ),
		'makaseru'  => array( 'page' => 'makaseru' ),
		'shiraberu' => array( 'file' => 'shiraberu.html' ),
		'shindan'   => array( 'file' => 'shindan.html' ),
	);
}

function sasayell_services_url( $slug = '' ) {
	$top = home_url( '/' . SASAYELL_SERVICES_PARENT_SLUG . '/' );
	return '' === $slug ? $top : add_query_arg( SASAYELL_SERVICES_PARAM, $slug, $top );
}

/**
 * 1枚HTML内の相対パスを officeplata.com 上のURLに読み替える。
 */
function sasayell_services_rewrite( $html ) {
	$img = plugin_dir_url( __FILE__ ) . 'assets/images/';
	$html = str_replace( array( '"./images/', "'./images/" ), array( '"' . $img, "'" . $img ), $html );

	foreach ( array_keys( sasayell_services_map() ) as $slug ) {
		$url  = esc_url( sasayell_services_url( $slug ) );
		$html = str_replace( array( '"./' . $slug . '.html', "'./" . $slug . '.html' ), array( '"' . $url, "'" . $url ), $html );
	}
	// マカセルは既存の固定ページではなく、ささエール配下の表示に寄せる
	$html = str_replace( 'https://officeplata.com/makaseru/', esc_url( sasayell_services_url( 'makaseru' ) ), $html );

	$top  = esc_url( sasayell_services_url() );
	$html = str_replace( array( '"./index.html', "'./index.html" ), array( '"' . $top, "'" . $top ), $html );

	return $html;
}

/**
 * 既存の固定ページ（例: マカセル）の本文を、テーマを通さず単体ページとして出力する。
 */
function sasayell_services_page_html( $page_slug ) {
	$page = get_page_by_path( $page_slug );
	if ( ! $page || 'publish' !== $page->post_status ) {
		return '';
	}
	$body  = do_shortcode( do_blocks( $page->post_content ) );
	$title = get_the_title( $page ) . ' | ささエール';

	return '<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>' . esc_html( $title ) . '</title>
<link rel="canonical" href="' . esc_url( get_permalink( $page ) ) . '">
<style>html,body{margin:0;padding:0;background:#FFD600}</style>
</head>
<body>
' . $body . '
</body>
</html>';
}

/**
 * トップ（sasayell-lp の出力）の「選べるサービス一覧」末尾に、各サービスページへのカードを差し込む。
 */
function sasayell_services_top_cards() {
	$cards = array(
		'yatoeiru'  => array( 'やとエール', 'あなたの会社だけの「AI社員」をつくるサービス。ヒアリングで最適な社員構成を設計し、自走できるまで伴走します。' ),
		'manaberu'  => array( 'まなベール', 'LarkとAIを道具に、自社のサービスやアプリを自分の手で形にする少人数オンライン講座です。' ),
		'makaseru'  => array( 'まかセール', '作りたいもの1つに絞って、現役の開発者が完成までマンツーマンで伴走します。' ),
		'shiraberu' => array( 'しらベール', '社員の声を毎月あつめる匿名アンケート。Lark・LINEから答えられて、AIが「次の一手」を提案します。' ),
		'shindan'   => array( 'さっさー相性診断', '8つの質問に答えるだけ。いまのあなたに合うささエールのサービスを、1分で診断します。', '診断してみる →' ),
	);
	$html = '
        <!-- サービス別ページ（sasayell-services） -->
        <style>@media (min-width:1101px){.cards-3.ssv-cards{grid-template-columns:repeat(3,1fr)}}.ssv-cards a.service-card{display:flex;flex-direction:column;text-decoration:none;color:inherit}</style>
        <div class="service-group-head">
          <span class="service-group-label">サービス別ページ</span>
          <span class="service-group-line"></span>
        </div>
        <div class="cards-3 ssv-cards">';
	foreach ( $cards as $slug => $card ) {
		$html .= '
          <a class="service-card gs-card" href="' . esc_url( sasayell_services_url( $slug ) ) . '">
            <h3>' . esc_html( $card[0] ) . '</h3>
            <p>' . esc_html( $card[1] ) . '</p>
            <span class="price-mini" style="font-size:16px;">' . esc_html( isset( $card[2] ) ? $card[2] : '詳しく見る →' ) . '</span>
          </a>';
	}
	return $html . '
        </div>
';
}

function sasayell_services_inject_top( $html ) {
	if ( false !== strpos( $html, 'ssv-cards' ) ) {
		return $html;
	}
	// #services セクションの container 閉じタグの直前に差し込む
	$cards = sasayell_services_top_cards();
	$out   = preg_replace_callback(
		'#(<section[^>]*id="services".*?)(\s*</div>\s*</section>)#s',
		function ( $m ) use ( $cards ) {
			return $m[1] . $cards . $m[2];
		},
		$html,
		1
	);
	return is_string( $out ) ? $out : $html;
}

add_action(
	'template_redirect',
	function () {
		if ( is_page( SASAYELL_SERVICES_PARENT_SLUG ) && empty( $_GET[ SASAYELL_SERVICES_PARAM ] ) ) {
			ob_start( 'sasayell_services_inject_top' );
		}
	},
	-1
);

add_action(
	'template_redirect',
	function () {
		if ( empty( $_GET[ SASAYELL_SERVICES_PARAM ] ) || ! is_page( SASAYELL_SERVICES_PARENT_SLUG ) ) {
			return;
		}
		$slug = sanitize_key( wp_unslash( $_GET[ SASAYELL_SERVICES_PARAM ] ) );
		$map  = sasayell_services_map();
		if ( ! isset( $map[ $slug ] ) ) {
			return; // 未知の値はトップをそのまま表示
		}

		$html = '';
		if ( isset( $map[ $slug ]['file'] ) ) {
			$path = plugin_dir_path( __FILE__ ) . 'html/' . $map[ $slug ]['file'];
			if ( is_readable( $path ) ) {
				$html = sasayell_services_rewrite( file_get_contents( $path ) );
			}
		} elseif ( isset( $map[ $slug ]['page'] ) ) {
			$html = sasayell_services_page_html( $map[ $slug ]['page'] );
		}
		if ( '' === $html ) {
			return;
		}

		status_header( 200 );
		nocache_headers();
		header( 'Content-Type: text/html; charset=UTF-8' );
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- 自前の静的HTML
		exit;
	},
	0
);
