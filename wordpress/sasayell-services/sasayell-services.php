<?php
/**
 * Plugin Name: ささエール サービスページ
 * Description: /sasayell/?service=yatoeiru|manaberu|makaseru|shiraberu で各サービスページを表示します。テーマのCSS・ヘッダー・フッターは読み込みません。
 * Version: 1.0.0
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
